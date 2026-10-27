import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

const INDEX_CANDIDATES = ['index.js', 'index.ts', 'index.mjs'];

/**
 * Registers `<dir>/<module>/index` (default export = Fastify plugin) for every
 * module folder. A folder without an index is skipped with a warning, so a
 * new module needs only its own folder (D-01, GR-006).
 */
export async function registerModules(app: FastifyInstance, dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const registered: string[] = [];
  const folders = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const folder of folders) {
    const indexFile = INDEX_CANDIDATES.map((name) => join(dir, folder, name)).find((file) => existsSync(file));
    if (!indexFile) {
      app.log.warn({ module: folder }, 'module skipped: no index file');
      continue;
    }
    const imported = (await import(/* @vite-ignore */ pathToFileURL(indexFile).href)) as {
      default?: FastifyPluginAsync;
    };
    if (typeof imported.default !== 'function') {
      app.log.warn({ module: folder }, 'module skipped: index has no default plugin export');
      continue;
    }
    await app.register(imported.default);
    registered.push(folder);
  }
  return registered;
}
