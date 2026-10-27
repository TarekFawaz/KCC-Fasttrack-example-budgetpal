import type { ComponentType } from 'react';

/** What a `web/src/features/<x>/feature.ts` exports (default export, or a named `feature`, or a `features` array). */
export interface Feature {
  id: string;
  path: string;
  label: string;
  order: number;
  component: ComponentType;
  /** Reachable without a session (the auth routes). Default `false`; read it through `isPublic`. */
  public?: boolean;
}

type FeatureModule = { default?: Feature; feature?: Feature; features?: Feature[] };

function isFeature(value: unknown): value is Feature {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.path === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.order === 'number' &&
    (typeof candidate.component === 'function' || (typeof candidate.component === 'object' && candidate.component !== null)) &&
    (candidate.public === undefined || typeof candidate.public === 'boolean')
  );
}

/** Pure: the `public` flag with its default applied, so callers never read the raw field. */
export function isPublic(feature: Feature): boolean {
  return feature.public === true;
}

/** Every feature one module exports, each with the place it came from (for error messages). */
function exportsOf(file: string, module: FeatureModule): Array<{ entry: unknown; where: string }> {
  const found: Array<{ entry: unknown; where: string }> = [];
  const single = module.default ?? module.feature;
  if (single !== undefined) found.push({ entry: single, where: file });
  if (module.features !== undefined) {
    if (Array.isArray(module.features)) {
      module.features.forEach((entry, index) => found.push({ entry, where: `${file}#${index}` }));
    } else {
      found.push({ entry: module.features, where: file });
    }
  }
  return found;
}

/**
 * Pure: turns the modules found by `import.meta.glob` into the sorted feature
 * list. Throws on a malformed feature or a duplicate `id` (across files or
 * inside one `features` array) so a bad module fails loudly at start instead of
 * shadowing another one.
 */
export function buildRegistry(modules: Record<string, unknown>): Feature[] {
  const features: Feature[] = [];
  const seen = new Map<string, string>();
  for (const [file, module] of Object.entries(modules)) {
    const exported = exportsOf(file, module as FeatureModule);
    if (exported.length === 0) {
      throw new Error(`Feature module ${file} must export {id, path, label, order, component}`);
    }
    for (const { entry, where } of exported) {
      if (!isFeature(entry)) {
        throw new Error(
          `Feature module ${where} must export {id, path, label, order, component} with an optional boolean public`,
        );
      }
      const first = seen.get(entry.id);
      if (first !== undefined) {
        throw new Error(`Duplicate feature id "${entry.id}" in ${first} and ${where}`);
      }
      seen.set(entry.id, where);
      features.push(entry);
    }
  }
  return features.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Every feature folder is picked up here; adding one never edits a shared file (D-01, GR-006). */
export const features: Feature[] = buildRegistry(
  import.meta.glob('../features/*/feature.ts', { eager: true }),
);
