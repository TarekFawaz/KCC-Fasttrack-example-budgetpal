import { describe, expect, it } from 'vitest';
import { buildRegistry, features, isPublic, type Feature } from './registry';

const page = () => null;

function feature(id: string, order: number, path = `/${id}`, isOpen?: boolean): Feature {
  return { id, path, label: id.toUpperCase(), order, component: page, ...(isOpen === undefined ? {} : { public: isOpen }) };
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

  it('T-001 defaults public to false (via isPublic), keeps true and rejects a non-boolean naming the file', () => {
    const registry = buildRegistry({
      '../features/a/feature.ts': { default: feature('a', 1) },
      '../features/b/feature.ts': { default: feature('b', 2, '/b', true) },
      '../features/c/feature.ts': { default: feature('c', 3, '/c', false) },
    });
    expect(registry.map(isPublic)).toEqual([false, true, false]);
    const bad = { ...feature('bad', 1), public: 'yes' };
    expect(() => buildRegistry({ '../features/bad/feature.ts': { default: bad } })).toThrow(
      /\.\.\/features\/bad\/feature\.ts/,
    );
  });

  it('T-002 registers every entry of a features array, with and without a default, sorted', () => {
    const registry = buildRegistry({
      '../features/pair/feature.ts': { features: [feature('b', 20), feature('a', 10)] },
      '../features/mixed/feature.ts': { default: feature('m', 15), features: [feature('n', 5)] },
    });
    expect(registry.map((entry) => entry.id)).toEqual(['n', 'a', 'm', 'b']);
  });

  it('T-002 validates each entry of a features array', () => {
    expect(() =>
      buildRegistry({ '../features/pair/feature.ts': { features: [feature('ok', 1), { id: 'broken' } as unknown as Feature] } }),
    ).toThrow(/pair\/feature\.ts#1/);
  });

  it('T-003 throws on a duplicate id across files and inside one features array, naming both places', () => {
    expect(() =>
      buildRegistry({
        '../features/one/feature.ts': { features: [feature('x', 1)] },
        '../features/two/feature.ts': { default: feature('x', 2) },
      }),
    ).toThrow(/Duplicate feature id "x".*one\/feature\.ts#0.*two\/feature\.ts/);
    expect(() =>
      buildRegistry({ '../features/one/feature.ts': { features: [feature('y', 1), feature('y', 2)] } }),
    ).toThrow(/Duplicate feature id "y".*one\/feature\.ts#0.*one\/feature\.ts#1/);
  });

  it('T-004 keeps the original T-012 behaviour (the cases above run unchanged)', () => {
    expect(buildRegistry({})).toEqual([]);
    expect(() => buildRegistry({ '../features/none/feature.ts': {} })).toThrow(/must export/);
  });

  it('T-005 isPublic returns the flag with false as default and reads no raw field', () => {
    expect(isPublic(feature('a', 1))).toBe(false);
    expect(isPublic(feature('a', 1, '/a', true))).toBe(true);
    expect(isPublic(feature('a', 1, '/a', false))).toBe(false);
    const registry = buildRegistry({ '../features/a/feature.ts': { default: feature('a', 1) } });
    expect(isPublic(registry[0]!)).toBe(false);
  });
});
