import { describe, expect, it } from 'vitest';
import { buildRegistry, features, type Feature } from './registry';

const page = () => null;

function feature(id: string, order: number, path = `/${id}`): Feature {
  return { id, path, label: id.toUpperCase(), order, component: page };
}

describe('buildRegistry', () => {
  it('T-012 sorts features by order, whatever order the files were found in', () => {
    const registry = buildRegistry({
      '../features/c/feature.ts': { default: feature('c', 30) },
      '../features/a/feature.ts': { default: feature('a', 10) },
      '../features/b/feature.ts': { feature: feature('b', 20) },
    });
    expect(registry.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('T-012 breaks order ties by id so the nav is stable', () => {
    const registry = buildRegistry({
      '../features/z/feature.ts': { default: feature('z', 5) },
      '../features/m/feature.ts': { default: feature('m', 5) },
    });
    expect(registry.map((entry) => entry.id)).toEqual(['m', 'z']);
  });

  it('T-012 throws on a duplicate id and names both files', () => {
    expect(() =>
      buildRegistry({
        '../features/one/feature.ts': { default: feature('same', 1) },
        '../features/two/feature.ts': { default: feature('same', 2) },
      }),
    ).toThrow(/Duplicate feature id "same".*one.*two/);
  });

  it('T-012 throws on a module that does not export a feature', () => {
    expect(() => buildRegistry({ '../features/bad/feature.ts': { default: { id: 'bad' } } })).toThrow(
      /\.\.\/features\/bad\/feature\.ts/,
    );
    expect(() => buildRegistry({ '../features/none/feature.ts': {} })).toThrow(/must export/);
  });

  it('T-012 returns an empty list when there are no feature modules', () => {
    expect(buildRegistry({})).toEqual([]);
  });

  it('T-012 the real registry is a sorted list of valid features', () => {
    const orders = features.map((entry) => entry.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
