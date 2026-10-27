import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../kernel/config.js';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import { createLoggedInUser, type LoggedInUser } from '../../../test/helpers/auth.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const PATH = '/api/import/commit';
const BOUNDARY = '----kccImportCommitBoundary';

interface Problem {
  status: number;
  errors?: Array<{ field: string; message: string }>;
}
interface Commit {
  imported: number;
  skipped: number;
  invalid: number;
  invalidRows: Array<{ line: number; reason: string }>;
}
interface TransactionPage {
  items: Array<{ id: number; accountId: number; categoryId: number; occurredOn: string; amountMinor: number }>;
  total: number;
}

interface Owner {
  user: LoggedInUser;
  account: number;
  expense: number;
  income: number;
}

let db: Database.Database;
let app: FastifyInstance;
let alice: Owner;
let bob: Owner;
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
const makeOwner = (email: string): Owner => {
  const user = createLoggedInUser(app, email);
  return { user, account: addAccount(user.id), expense: addCategory(user.id, 'expense'), income: addCategory(user.id, 'income') };
};
const countFor = (userId: number): number =>
  (db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(userId) as { n: number }).n;
const countAll = (): number => (db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number }).n;

/** A multipart/form-data body built by hand: `inject` has no form helper and the route must see real parts. */
function form(fields: Record<string, string>, file?: { content: string | Buffer }) {
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8'),
    );
  }
  if (file) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="bank.csv"\r\nContent-Type: text/csv\r\n\r\n`,
        'utf8',
      ),
      Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8'),
      Buffer.from('\r\n', 'utf8'),
    );
  }
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`, 'utf8'));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` } };
}

const MAPPING = JSON.stringify({ date: 0, amount: 1, description: 2 });
const fieldsFor = (owner: Owner, extra: Record<string, string> = {}): Record<string, string> => ({
  accountId: String(owner.account),
  mapping: MAPPING,
  dateFormat: 'YYYY-MM-DD',
  expenseCategoryId: String(owner.expense),
  incomeCategoryId: String(owner.income),
  ...extra,
});

const post = (user: LoggedInUser | undefined, fields: Record<string, string>, file?: { content: string | Buffer }) => {
  const body = form(fields, file);
  return app.inject({
    method: 'POST',
    url: PATH,
    payload: body.payload,
    headers: { ...body.headers, ...(user ? user.headers : {}) },
  });
};

const dayOf = (index: number): string => `2026-03-${String((index % 28) + 1).padStart(2, '0')}`;

/** Header plus `count` distinct rows, alternating expense (negative) and income (positive). */
function rowsCsv(count: number, prefix = 'Item'): string {
  const lines = ['Date,Amount,Description'];
  for (let i = 0; i < count; i += 1) lines.push(`${dayOf(i)},${i % 2 === 0 ? '-' : ''}${i + 1}.50,${prefix} ${i + 1}`);
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
  alice = makeOwner('alice@example.test');
  bob = makeOwner('bob@example.test');
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('POST /api/import/commit (Story-002)', () => {
  it('T-023 a 10-row file returns {imported, skipped, invalid, invalidRows} and stores a formula description verbatim (AC-1)', async () => {
    const csv = `${rowsCsv(9)}\n2026-03-05,-1.00,=SUM(A1)`;
    const res = await post(alice.user, fieldsFor(alice), { content: csv });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ imported: 10, skipped: 0, invalid: 0, invalidRows: [] });
    expect(countFor(alice.user.id)).toBe(10);
    const stored = db
      .prepare('SELECT description, amount_minor AS amountMinor, category_id AS categoryId FROM transactions WHERE description = ?')
      .get('=SUM(A1)') as { description: string; amountMinor: number; categoryId: number };
    expect(stored).toEqual({ description: '=SUM(A1)', amountMinor: 100, categoryId: alice.expense });
    // A positive amount lands in the income category, positive; a negative one is stored as its absolute value.
    const income = db
      .prepare('SELECT amount_minor AS amountMinor, category_id AS categoryId FROM transactions WHERE description = ?')
      .get('Item 2') as { amountMinor: number; categoryId: number };
    expect(income).toEqual({ amountMinor: 250, categoryId: alice.income });
  });

  it('T-024 importing the same file twice imports 0 the second time and skips every valid row (AC-2)', async () => {
    const csv = rowsCsv(10);
    const first = await post(alice.user, fieldsFor(alice), { content: csv });
    expect((first.json() as Commit).imported).toBe(10);
    const second = await post(alice.user, fieldsFor(alice), { content: csv });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ imported: 0, skipped: 10, invalid: 0, invalidRows: [] });
    expect(countFor(alice.user.id)).toBe(10);
  });

  it('T-024 a duplicate inside one file counts as skipped, whatever the case and spacing of its description', async () => {
    const csv = 'Date,Amount,Description\n2026-03-01,-5.00,Coffee Shop\n2026-03-01,-5.00,  coffee   SHOP \n2026-03-02,-5.00,Coffee Shop';
    const res = await post(alice.user, fieldsFor(alice), { content: csv });
    expect(res.json()).toEqual({ imported: 2, skipped: 1, invalid: 0, invalidRows: [] });
    expect(countFor(alice.user.id)).toBe(2);
  });

  it('T-025 invalid rows are reported by line and never stored; the valid ones are (AC-3)', async () => {
    const lines = rowsCsv(8).split('\n');
    lines.splice(3, 0, '2026-02-30,5.00,Bad date');
    lines.push('2026-03-01,abc,Bad amount');
    const res = await post(alice.user, fieldsFor(alice), { content: lines.join('\n') });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Commit;
    expect(body.imported).toBe(8);
    expect(body.skipped).toBe(0);
    expect(body.invalid).toBe(2);
    expect(body.invalidRows.map((row) => row.line)).toEqual([4, 11]);
    expect(body.invalidRows[0]?.reason).toMatch(/date/i);
    expect(body.invalidRows[1]?.reason).toMatch(/amount/i);
    expect(countFor(alice.user.id)).toBe(8);
    expect(db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE description LIKE 'Bad%'").get()).toEqual({ n: 0 });
  });

  it('T-025 a row whose sign has no category chosen is reported invalid and not stored (A-1)', async () => {
    const csv = 'Date,Amount,Description\n2026-03-01,-5.00,Spend\n2026-03-02,7.00,Earn';
    const fields = fieldsFor(alice);
    delete fields['incomeCategoryId'];
    const res = await post(alice.user, fields, { content: csv });
    expect(res.json()).toEqual({
      imported: 1,
      skipped: 0,
      invalid: 1,
      invalidRows: [{ line: 3, reason: 'No income category chosen' }],
    });
  });

  it('T-026 another user\'s account is a 404 problem+json and nothing is written (AC-4)', async () => {
    const res = await post(alice.user, fieldsFor(alice, { accountId: String(bob.account) }), { content: rowsCsv(5) });
    expect(res.statusCode).toBe(404);
    expect(String(res.headers['content-type'])).toContain('application/problem+json');
    const unknown = await post(alice.user, fieldsFor(alice, { accountId: '999999' }), { content: rowsCsv(5) });
    expect(unknown.statusCode).toBe(404);
    expect(countAll()).toBe(0);
  });

  it('T-026 a category that is not the caller\'s is a 400 and nothing is written', async () => {
    const res = await post(alice.user, fieldsFor(alice, { expenseCategoryId: String(bob.expense) }), {
      content: rowsCsv(5),
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as Problem).errors?.[0]?.field).toBe('expenseCategoryId');
    expect(countAll()).toBe(0);
  });

  it('T-027 two users importing the same rows each keep their own and see only their own (AC-4)', async () => {
    const csv = rowsCsv(6);
    const a = await post(alice.user, fieldsFor(alice), { content: csv });
    const b = await post(bob.user, fieldsFor(bob), { content: csv });
    expect((a.json() as Commit).imported).toBe(6);
    expect((b.json() as Commit).imported).toBe(6);
    expect(countFor(alice.user.id)).toBe(6);
    expect(countFor(bob.user.id)).toBe(6);
    const listA = await app.inject({ method: 'GET', url: '/api/transactions?limit=200', headers: alice.user.headers });
    const listB = await app.inject({ method: 'GET', url: '/api/transactions?limit=200', headers: bob.user.headers });
    const pageA = listA.json() as TransactionPage;
    const pageB = listB.json() as TransactionPage;
    expect(pageA.total).toBe(6);
    expect(pageB.total).toBe(6);
    expect(pageA.items.every((item) => item.accountId === alice.account)).toBe(true);
    expect(pageB.items.every((item) => item.accountId === bob.account)).toBe(true);
  });

  describe('T-028 bad input and no session write nothing (AC-5)', () => {
    it('a 6 MB file is a 400 problem+json naming the file', async () => {
      const big = Buffer.from(`Date,Amount,Description\n${'x'.repeat(6 * 1024 * 1024)}\n`, 'utf8');
      const res = await post(alice.user, fieldsFor(alice), { content: big });
      expect(res.statusCode).toBe(400);
      expect(String(res.headers['content-type'])).toContain('application/problem+json');
      expect((res.json() as Problem).errors?.[0]?.field).toBe('file');
      expect(res.body).not.toMatch(/\bat\s.+\(|stack|node_modules/i);
      expect(countAll()).toBe(0);
    });

    it('5001 rows is a 400 and stores none of them', async () => {
      const res = await post(alice.user, fieldsFor(alice), { content: rowsCsv(5001) });
      expect(res.statusCode).toBe(400);
      expect((res.json() as Problem).errors?.[0]?.field).toBe('file');
      expect(countAll()).toBe(0);
    });

    it('a request without a mapping or a date format is a 400 (commit needs both)', async () => {
      const noMapping: Record<string, string> = fieldsFor(alice);
      delete noMapping['mapping'];
      const first = await post(alice.user, noMapping, { content: rowsCsv(2) });
      expect(first.statusCode).toBe(400);
      expect((first.json() as Problem).errors?.map((error) => error.field)).toContain('mapping');
      const noFormat: Record<string, string> = fieldsFor(alice);
      delete noFormat['dateFormat'];
      const second = await post(alice.user, noFormat, { content: rowsCsv(2) });
      expect(second.statusCode).toBe(400);
      expect((second.json() as Problem).errors?.map((error) => error.field)).toContain('dateFormat');
      expect(countAll()).toBe(0);
    });

    it('invalid UTF-8 and a missing file are 400s', async () => {
      const latin1 = Buffer.concat([Buffer.from('Date,Amount,Description\n2026-03-01,1.00,Caf'), Buffer.from([0xe9])]);
      expect((await post(alice.user, fieldsFor(alice), { content: latin1 })).statusCode).toBe(400);
      expect((await post(alice.user, fieldsFor(alice))).statusCode).toBe(400);
      expect(countAll()).toBe(0);
    });

    it('no session is a 401 problem+json whatever the body holds', async () => {
      const res = await post(undefined, fieldsFor(alice), { content: rowsCsv(3) });
      expect(res.statusCode).toBe(401);
      expect(String(res.headers['content-type'])).toContain('application/problem+json');
      const garbage = await app.inject({
        method: 'POST',
        url: PATH,
        payload: 'not a form',
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      });
      expect(garbage.statusCode).toBe(401);
      expect(countAll()).toBe(0);
    });
  });

  it('T-029 a 5000-row commit finishes in under 10 s and the rows appear in GET /transactions by account and month (AC-6)', async () => {
    const csv = rowsCsv(5000);
    const started = performance.now();
    const res = await post(alice.user, fieldsFor(alice), { content: csv });
    const elapsedMs = performance.now() - started;
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ imported: 5000, skipped: 0, invalid: 0, invalidRows: [] });
    expect(elapsedMs).toBeLessThan(10_000);

    const url = `/api/transactions?accountId=${alice.account}&month=2026-03&limit=200`;
    const listed = await app.inject({ method: 'GET', url, headers: alice.user.headers });
    expect(listed.statusCode).toBe(200);
    const page = listed.json() as TransactionPage;
    expect(page.total).toBe(5000);
    expect(page.items).toHaveLength(200);
    expect(page.items.every((item) => item.accountId === alice.account && item.occurredOn.startsWith('2026-03'))).toBe(true);
    const other = await app.inject({
      method: 'GET',
      url: `/api/transactions?accountId=${alice.account}&month=2026-04&limit=200`,
      headers: alice.user.headers,
    });
    expect((other.json() as TransactionPage).total).toBe(0);
  });

  it('T-030 the log holds counts and no row content, and /api/import/commit is in the OpenAPI document (AC-7)', async () => {
    const csv = 'Date,Amount,Description\n2026-03-01,-987.65,ZZSECRETMEMO\n2026-03-02,abc,ZZOTHERMEMO\n2026-03-03,12.34,ZZTHIRDMEMO';
    const ok = await post(alice.user, fieldsFor(alice), { content: csv });
    expect(ok.statusCode).toBe(200);
    await post(alice.user, fieldsFor(alice), { content: csv });
    await post(alice.user, fieldsFor(alice, { mapping: JSON.stringify({ date: 0, amount: 1, description: 9 }) }), {
      content: csv,
    });
    expect(logLines).toContain('import.committed');
    expect(logLines).toContain('"imported":2');
    for (const secret of ['ZZSECRETMEMO', 'ZZOTHERMEMO', 'ZZTHIRDMEMO', '987.65', '98765', '1234', 'Description']) {
      expect(logLines).not.toContain(secret);
    }

    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    const doc = res.json() as { paths: Record<string, { post?: { responses?: Record<string, unknown> } }> };
    const operation = doc.paths[PATH]?.post;
    expect(operation).toBeDefined();
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(['200', '400', '401', '404']);
  });
});
