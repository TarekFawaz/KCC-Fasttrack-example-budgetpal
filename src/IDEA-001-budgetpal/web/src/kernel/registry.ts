import type { ComponentType } from 'react';

/** What a `web/src/features/<x>/feature.ts` exports (default export, or a named `feature`). */
export interface Feature {
  id: string;
  path: string;
  label: string;
  order: number;
  component: ComponentType;
}

type FeatureModule = { default?: Feature; feature?: Feature };

function isFeature(value: unknown): value is Feature {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.path === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.order === 'number' &&
    (typeof candidate.component === 'function' || (typeof candidate.component === 'object' && candidate.component !== null))
  );
}

/**
 * Pure: turns the modules found by `import.meta.glob` into the sorted feature
 * list. Throws on a malformed feature or a duplicate `id` so a bad module fails
 * loudly at start instead of shadowing another one.
 */
export function buildRegistry(modules: Record<string, unknown>): Feature[] {
  const features: Feature[] = [];
  const seen = new Map<string, string>();
  for (const [file, module] of Object.entries(modules)) {
    const exported = (module as FeatureModule).default ?? (module as FeatureModule).feature;
    if (!isFeature(exported)) {
      throw new Error(`Feature module ${file} must export {id, path, label, order, component}`);
    }
    const first = seen.get(exported.id);
    if (first !== undefined) {
      throw new Error(`Duplicate feature id "${exported.id}" in ${first} and ${file}`);
    }
    seen.set(exported.id, file);
    features.push(exported);
  }
  return features.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Every feature folder is picked up here; adding one never edits a shared file (D-01, GR-006). */
export const features: Feature[] = buildRegistry(
  import.meta.glob('../features/*/feature.ts', { eager: true }),
);
