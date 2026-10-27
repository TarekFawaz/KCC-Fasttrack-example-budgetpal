import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../kernel/config.js';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import { createLoggedInUser, type LoggedInUser } from '../../../test/helpers/auth.js';

// Every way node:fs can put bytes on disk is wrapped in a spy; the real function still runs (T-017).
const writes = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  const spy =
    <F extends (...args: never[]) => unknown>(name: string, fn: F): F =>
    ((...args: Parameters<F>) => {
      writes.calls.push(name);
      return fn(...args);
    }) as F;
  return {
    ...original,
    default: original,
    writeFile: spy('writeFile', original.writeFile),
    writeFileSync: spy('writeFileSync', original.writeFileSync),
    appendFile: spy('appendFile', original.appendFile),
    appendFileSync: spy('appendFileSync', original.appendFileSync),
    createWriteStream: spy('createWriteStream', original.createWriteStream),
    copyFile: spy('copyFile', original.copyFile),
    mkdtemp: spy('mkdtemp', original.mkdtemp),
  };
});
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    default: original,
    writeFile: (...args: Parameters<typeof original.writeFile>) => {
      writes.calls.push('promises.writeFile');
      return original.writeFile(...args);
    },
    appendFile: (...args: Parameters<typeof original.appendFile>) => {
      writes.calls.push('promises.appendFile');
      return original.appendFile(...args);
    },
  };
});

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const PATH = '/api/import/preview';
const BOUNDARY = '----kccImportTestBoundary';

interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Array<{ field: string; message: string }>;
}
interface Preview {
  headers: string[];
  hasHeader: boolean;
  suggestedMapping: { date: number; amount: number; description: number } | null;
  rowCount: number;
  validCount: number;
  invalidCount: number;
  validRows: Array<{ line: number; date: string; amountMinor: number; description: string }>;
  invalidRows: Array<{ line: number; reason: string }>;
}

let db: Database.Database;
let app: FastifyInstance;
let alice: LoggedInUser;
let bob: LoggedInUser;
let aliceAccount: number;
let aliceExpense: number;
let aliceIncome: number;
let bobAccount: number;
let logLines: string;

const addAccount = (userId: number): number =>
  Number(
    db
      .prepare(
        'INSERT INTO accounts (user_id, name, type, opening_balance_minor, created_at, updated_at) VALUES (?, ?, ?, 0, 1, 1)',
      )
      .run(userId, `acct-${userId}`, 'checking').lastInsertRowid,
  );
const addCategory = (userId: number, kind: 'expense' | 'income'): number =>
  Number(
    db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, `${kind}-${userId}`, kind, '2026-01-01T00:00:00.000Z').lastInsertRowid,
  );
const rowCount = (): number => (db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number }).n;

/** A multipart/form-data body built by hand: `inject` has no form helper and the route must see real parts. */
function form(fields: Record<string, string>, file?: { content: string | Buffer; name?: string }) {
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8'),
    );
  }
  if (file) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${file.name ?? 'bank.csv'}"\r\nContent-Type: text/csv\r\n\r\n`,
        'utf8',
      ),
      Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8'),
      Buffer.from('\r\n', 'utf8'),
    );
  }
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`, 'utf8'));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` } };
}

const post = (
  user: LoggedInUser | undefined,
  fields: Record<string, string>,
  file?: { content: string | Buffer },
) => {
  const body = form(fields, file);
  return app.inject({
    method: 'POST',
    url: PATH,
    payload: body.payload,
    headers: { ...body.headers, ...(user ? user.headers : {}) },
  });
};

const MAPPING = JSON.stringify({ date: 0, amount: 1, description: 2 });
const withMapping = (extra: Record<string, string> = {}) => ({
  accountId: String(aliceAccount),
  mapping: MAPPING,
  dateFormat: 'YYYY-MM-DD',
  expenseCategoryId: String(aliceExpense),
  incomeCategoryId: String(aliceIncome),
  ...extra,
});
const dayOf = (index: number): string => `2026-03-${String((index % 28) + 1).padStart(2, '0')}`;

/** Header, `valid` good rows (alternating expense and income), then a bad date and a bad amount. */
function sampleCsv(valid: number): string {
  const lines = ['Date,Amount,Description'];
  for (let i = 0; i < valid; i += 1) lines.push(`${dayOf(i)},${i % 2 === 0 ? '-' : ''}${i + 1}.50,Item ${i + 1}`);
  lines.push('2026-02-30,5.00,Bad date');
  lines.push('2026-03-01,abc,Bad amount');
  return lines.join('\n');
}

beforeEach(async () => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  logLines = '';
  const logStream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      logLines += chunk.toString();
      callback();
    },
  });
  app = await buildApp(loadConfig({ LOG_LEVEL: 'info' }), { db, logStream });
  await app.ready();
  alice = createLoggedInUser(app, 'alice@example.test');
  bob = createLoggedInUser(app, 'bob@example.test');
  aliceAccount = addAccount(alice.id);
  aliceExpense = addCategory(alice.id, 'expense');
  aliceIncome = addCategory(alice.id, 'income');
  bobAccount = addAccount(bob.id);
  writes.calls.length = 0;
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('POST /api/import/preview (Story-001)', () => {
  it('T-015 with a mapping returns headers, suggested mapping, counts, the first 20 valid rows and invalid rows by line (AC-1)', async () => {
    const res = await post(alice, withMapping(), { content: sampleCsv(25) });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Preview;
    expect(body.headers).toEqual(['Date', 'Amount', 'Description']);
    expect(body.hasHeader).toBe(true);
    expect(body.suggestedMapping).toEqual({ date: 0, amount: 1, description: 2 });
    expect(body.rowCount).toBe(27);
    expect(body.validCount).toBe(25);
    expect(body.invalidCount).toBe(2);
    expect(body.validRows).toHaveLength(20);
    expect(body.validRows[0]).toEqual({ line: 2, date: '2026-03-01', amountMinor: -150, description: 'Item 1' });
    expect(body.validRows[1]).toEqual({ line: 3, date: '2026-03-02', amountMinor: 250, description: 'Item 2' });
    expect(body.invalidRows.map((row) => row.line)).toEqual([27, 28]);
    expect(body.invalidRows[0]?.reason).toMatch(/date/i);
    expect(body.invalidRows[1]?.reason).toMatch(/amount/i);
  });

  it('T-015 a negative row without an expense category (A-1) is reported invalid by line, a positive one without income too', async () => {
    const csv = 'Date,Amount,Description\n2026-03-01,-5.00,Spend\n2026-03-02,7.00,Earn\n';
    const res = await post(
      alice,
      { accountId: String(aliceAccount), mapping: MAPPING, dateFormat: 'YYYY-MM-DD' },
      { content: csv },
    );
    const body = res.json() as Preview;
    expect(body.validCount).toBe(0);
    expect(body.invalidRows).toEqual([
      { line: 2, reason: 'No expense category chosen' },
      { line: 3, reason: 'No income category chosen' },
    ]);
  });

  it('T-015 a category that is not the caller\'s, or has the wrong kind, is a 400 naming the field (A-1)', async () => {
    const bobExpense = addCategory(bob.id, 'expense');
    const csv = sampleCsv(2);
    const foreign = await post(alice, withMapping({ expenseCategoryId: String(bobExpense) }), { content: csv });
    expect(foreign.statusCode).toBe(400);
    expect((foreign.json() as Problem).errors).toEqual([
      { field: 'expenseCategoryId', message: expect.any(String) as string },
    ]);
    const wrongKind = await post(alice, withMapping({ incomeCategoryId: String(aliceExpense) }), { content: csv });
    expect(wrongKind.statusCode).toBe(400);
    expect((wrongKind.json() as Problem).errors?.[0]?.field).toBe('incomeCategoryId');
  });

  it('T-016 without a mapping returns the headers and a suggested mapping by name and validates no row (AC-2)', async () => {
    const csv = 'Booking Date,Memo,Amount\n2026-03-01,Coffee,-3.20\n';
    const res = await post(alice, { accountId: String(aliceAccount) }, { content: csv });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Preview;
    expect(body.headers).toEqual(['Booking Date', 'Memo', 'Amount']);
    expect(body.suggestedMapping).toEqual({ date: 0, amount: 2, description: 1 });
    expect(body).toMatchObject({ rowCount: 1, validCount: 0, invalidCount: 0, validRows: [], invalidRows: [] });
  });

  it('T-016 a header-less file gets Column n names and no suggested mapping', async () => {
    const res = await post(alice, { accountId: String(aliceAccount) }, { content: '2026-03-01,-3.20,Coffee\n' });
    const body = res.json() as Preview;
    expect(body.hasHeader).toBe(false);
    expect(body.headers).toEqual(['Column 1', 'Column 2', 'Column 3']);
    expect(body.suggestedMapping).toBeNull();
  });

  it('T-017 a preview inserts nothing and writes no file (AC-3)', async () => {
    const before = rowCount();
    const res = await post(alice, withMapping(), { content: sampleCsv(10) });
    expect(res.statusCode).toBe(200);
    expect(rowCount()).toBe(before);
    expect(db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(alice.id)).toEqual({ n: 0 });
    expect(writes.calls).toEqual([]);
  });

  it('T-018 without a session returns 401 problem+json before the body is read (AC-4)', async () => {
    const res = await post(undefined, withMapping(), { content: sampleCsv(2) });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const garbage = await app.inject({
      method: 'POST',
      url: PATH,
      payload: 'not a form',
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    });
    expect(garbage.statusCode).toBe(401);
  });

  it('T-019 another user\'s account id is a 404 and nothing of the caller changes (AC-4)', async () => {
    const res = await post(alice, withMapping({ accountId: String(bobAccount) }), { content: sampleCsv(3) });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const unknown = await post(alice, withMapping({ accountId: '999999' }), { content: sampleCsv(3) });
    expect(unknown.statusCode).toBe(404);
    expect(rowCount()).toBe(0);
  });

  describe('T-020 bad input is a 400 problem+json with field errors and no stack (AC-5)', () => {
    const expectProblem = (res: { statusCode: number; headers: Record<string, unknown>; body: string }) => {
      expect(res.statusCode).toBe(400);
      expect(String(res.headers['content-type'])).toContain('application/problem+json');
      const problem = JSON.parse(res.body) as Problem;
      expect(problem.status).toBe(400);
      expect(problem.errors?.length ?? 0).toBeGreaterThan(0);
      expect(res.body).not.toMatch(/\bat\s.+\(|stack|node_modules/i);
      return problem;
    };

    it('a 6 MB file', async () => {
      const big = Buffer.from(`Date,Amount,Description\n${'x'.repeat(6 * 1024 * 1024)}\n`, 'utf8');
      const problem = expectProblem(await post(alice, withMapping(), { content: big }));
      expect(problem.errors?.[0]?.field).toBe('file');
      expect(rowCount()).toBe(0);
    });

    it('5001 rows', async () => {
      const lines = ['Date,Amount,Description'];
      for (let i = 0; i < 5001; i += 1) lines.push(`2026-03-01,1.00,Row ${i}`);
      const problem = expectProblem(await post(alice, withMapping(), { content: lines.join('\n') }));
      expect(problem.errors?.[0]?.field).toBe('file');
    });

    it('a mapping that names a column the file does not have', async () => {
      const problem = expectProblem(
        await post(alice, withMapping({ mapping: JSON.stringify({ date: 0, amount: 1, description: 7 }) }), {
          content: sampleCsv(2),
        }),
      );
      expect(problem.errors).toEqual([{ field: 'mapping.description', message: expect.any(String) as string }]);
    });

    it('a mapping that is not JSON, an unknown field, a bad date format and a bad account id', async () => {
      const csv = sampleCsv(2);
      expect(expectProblem(await post(alice, withMapping({ mapping: '{nope' }), { content: csv })).errors?.[0]?.field).toBe(
        'mapping',
      );
      expect(expectProblem(await post(alice, withMapping({ extra: '1' }), { content: csv })).errors).toBeDefined();
      expect(
        expectProblem(await post(alice, withMapping({ dateFormat: 'YY-MM-DD' }), { content: csv })).errors?.[0]?.field,
      ).toBe('dateFormat');
      expect(expectProblem(await post(alice, withMapping({ accountId: 'abc' }), { content: csv })).errors?.[0]?.field).toBe(
        'accountId',
      );
    });

    it('a mapping without a date format, a missing file and invalid UTF-8', async () => {
      const csv = sampleCsv(2);
      const noFormat: Record<string, string> = withMapping();
      delete noFormat['dateFormat'];
      expect(expectProblem(await post(alice, noFormat, { content: csv })).errors?.[0]?.field).toBe('dateFormat');
      expect(expectProblem(await post(alice, withMapping())).errors?.[0]?.field).toBe('file');
      const latin1 = Buffer.concat([Buffer.from('Date,Amount,Description\n2026-03-01,1.00,Caf'), Buffer.from([0xe9]), Buffer.from('\n')]);
      expect(expectProblem(await post(alice, withMapping(), { content: latin1 })).errors?.[0]?.field).toBe('file');
    });

    it('a malformed multipart body and a request that is not multipart', async () => {
      const malformed = await app.inject({
        method: 'POST',
        url: PATH,
        payload: `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.csv"\r\n\r\nDate,Amount`,
        headers: { ...alice.headers, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      });
      expectProblem(malformed);
      const json = await app.inject({ method: 'POST', url: PATH, payload: { accountId: 1 }, headers: alice.headers });
      expect(json.statusCode).toBe(400);
      expect(String(json.headers['content-type'])).toContain('application/problem+json');
    });
  });

  it('T-021 /docs/json lists POST /api/import/preview with its status codes (AC-6)', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    const doc = res.json() as { paths: Record<string, { post?: { responses?: Record<string, unknown> } }> };
    const operation = doc.paths[PATH]?.post;
    expect(operation).toBeDefined();
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['200', '400', '401', '404']);
  });

  it('T-022 captured log output holds no CSV text, descriptions or amounts (AC-6)', async () => {
    const csv = 'Date,Amount,Description\n2026-03-01,-987.65,ZZSECRETMEMO\n2026-03-02,abc,ZZOTHERMEMO\n';
    const ok = await post(alice, withMapping(), { content: csv });
    expect(ok.statusCode).toBe(200);
    await post(alice, withMapping({ mapping: JSON.stringify({ date: 0, amount: 1, description: 9 }) }), { content: csv });
    await post(alice, withMapping(), { content: Buffer.from([0xff, 0xfe, 0x41]) });
    expect(logLines).toContain('import.previewed');
    for (const secret of ['ZZSECRETMEMO', 'ZZOTHERMEMO', '987.65', '98765', 'Description']) {
      expect(logLines).not.toContain(secret);
    }
  });
});
