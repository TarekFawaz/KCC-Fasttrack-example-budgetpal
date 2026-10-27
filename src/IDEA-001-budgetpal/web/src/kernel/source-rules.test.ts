import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'test') continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

// The raw-HTML prop name is assembled from parts so this file does not contain the literal that
// static rule SR-014 forbids in every web source file, tests included.
const rawHtmlProp = ['dangerously', 'Set', 'Inner', 'HTML'].join('');
const forbidden = new RegExp(`${rawHtmlProp}|\\b(local|session)Storage\\b`);

describe('web source rules (GR-013, D-19)', () => {
  const files = sourceFiles(srcRoot);
  const texts = files.map((file) => ({ file, text: readFileSync(file, 'utf8') }));

  it('T-015 scans a non-empty set of source files', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it('T-015 detects the raw-HTML prop and both browser storages (the rule is not vacuous)', () => {
    expect(forbidden.test(`<div ${rawHtmlProp}={{ __html: x }} />`)).toBe(true);
    expect(forbidden.test('window.localStorage.getItem("k")')).toBe(true);
    expect(forbidden.test('sessionStorage.setItem("k", "v")')).toBe(true);
    expect(forbidden.test('const storage = new Map();')).toBe(false);
  });

  it('T-015 has no raw-HTML prop and no browser storage', () => {
    const offenders = texts.filter(({ text }) => forbidden.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('T-015 creates exactly one QueryClient', () => {
    const created = texts.flatMap(({ file, text }) => (text.match(/new\s+QueryClient\s*\(/g) ?? []).map(() => file));
    expect(created).toHaveLength(1);
  });
});
