import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function readRoot(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

/** Parses KEY=VALUE lines, ignoring blanks and comments. */
export function parseEnvTemplate(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) throw new Error(`not a KEY=VALUE line: ${line}`);
    out.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return out;
}
