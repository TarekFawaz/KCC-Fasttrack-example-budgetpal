import type Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./categories.repository.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./categories.repository.js')>();
  return { ...original, list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
});

import * as repository from './categories.repository.js';
import { create, list, remove, update } from './categories.service.js';

const db = {} as Database.Database;
const stored = { id: 7, name: 'Food', kind: 'expense' as const, createdAt: '2026-01-01T00:00:00.000Z' };

describe('categories service (Story-001)', () => {
  it('T-008 create and list pass the caller\'s userId to the repository', () => {
    vi.mocked(repository.create).mockReturnValueOnce(stored);
    vi.mocked(repository.list).mockReturnValueOnce([stored]);

    const created = create(db, 42, { name: 'Food', kind: 'expense' }, '/api/categories');
    expect(created).toEqual({ ok: true, value: stored });
    expect(repository.create).toHaveBeenCalledWith(db, 42, { name: 'Food', kind: 'expense' });

    expect(list(db, 42)).toEqual([stored]);
    expect(repository.list).toHaveBeenCalledWith(db, 42);
  });

  it('T-010 maps DuplicateNameError to a 409 problem and rethrows anything else', () => {
    vi.mocked(repository.create).mockImplementationOnce(() => {
      throw new repository.DuplicateNameError();
    });
    const outcome = create(db, 1, { name: 'food', kind: 'expense' }, '/api/categories');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.problem).toMatchObject({ status: 409, title: 'Conflict', instance: '/api/categories' });
      expect(outcome.problem.errors).toEqual([{ field: 'name', message: expect.any(String) }]);
    }

    vi.mocked(repository.create).mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    expect(() => create(db, 1, { name: 'x', kind: 'income' }, '/api/categories')).toThrow('disk full');
  });
});

describe('categories service update and remove (Story-002)', () => {
  const instance = '/api/categories/7';

  it('T-018 maps duplicate, in-use and not-found outcomes to 409, 409 (in use) and 404', () => {
    // update: success passes the caller's userId and id through
    vi.mocked(repository.update).mockReturnValueOnce(stored);
    expect(update(db, 42, 7, { name: 'Food' }, instance)).toEqual({ ok: true, value: stored });
    expect(repository.update).toHaveBeenLastCalledWith(db, 42, 7, { name: 'Food' });

    // update: duplicate name -> 409 with a field error on name
    vi.mocked(repository.update).mockImplementationOnce(() => {
      throw new repository.DuplicateNameError();
    });
    const duplicate = update(db, 1, 7, { name: 'rent' }, instance);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.problem).toMatchObject({ status: 409, instance });
      expect(duplicate.problem.errors).toEqual([{ field: 'name', message: expect.any(String) }]);
    }

    // update: missing or another user's id -> 404
    vi.mocked(repository.update).mockReturnValueOnce(undefined);
    const missing = update(db, 1, 99, { kind: 'income' }, '/api/categories/99');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.problem).toMatchObject({ status: 404, instance: '/api/categories/99' });

    // remove: success, then not found, then in use
    vi.mocked(repository.remove).mockReturnValueOnce(true);
    expect(remove(db, 42, 7, instance)).toEqual({ ok: true, value: null });
    expect(repository.remove).toHaveBeenLastCalledWith(db, 42, 7);

    vi.mocked(repository.remove).mockReturnValueOnce(false);
    const gone = remove(db, 1, 7, instance);
    expect(gone.ok).toBe(false);
    if (!gone.ok) expect(gone.problem.status).toBe(404);

    vi.mocked(repository.remove).mockImplementationOnce(() => {
      throw new repository.CategoryInUseError();
    });
    const inUse = remove(db, 1, 7, instance);
    expect(inUse.ok).toBe(false);
    if (!inUse.ok) {
      expect(inUse.problem).toMatchObject({ status: 409, instance });
      expect(inUse.problem.detail).toMatch(/in use/i);
    }
  });

  it('T-018 rethrows errors it does not map', () => {
    vi.mocked(repository.update).mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    expect(() => update(db, 1, 7, { name: 'x' }, instance)).toThrow('disk full');
    vi.mocked(repository.remove).mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    expect(() => remove(db, 1, 7, instance)).toThrow('disk full');
  });
});
