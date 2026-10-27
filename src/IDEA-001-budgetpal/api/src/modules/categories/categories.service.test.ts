import type Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./categories.repository.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./categories.repository.js')>();
  return { ...original, list: vi.fn(), create: vi.fn() };
});

import * as repository from './categories.repository.js';
import { create, list } from './categories.service.js';

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
