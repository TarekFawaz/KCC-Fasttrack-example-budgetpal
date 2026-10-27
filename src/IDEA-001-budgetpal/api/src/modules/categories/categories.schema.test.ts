import { describe, expect, it } from 'vitest';
import { category, categoryParams, createCategory, updateCategory } from './categories.schema.js';

describe('categories.schema', () => {
  it('T-006 trims the name and accepts exactly 60 characters', () => {
    expect(createCategory.parse({ name: '  Food  ', kind: 'expense' })).toEqual({ name: 'Food', kind: 'expense' });
    expect(createCategory.safeParse({ name: 'x'.repeat(60), kind: 'income' }).success).toBe(true);
    expect(updateCategory.parse({ name: '  Meals ' })).toEqual({ name: 'Meals' });
  });

  it('T-006 rejects an empty (or blank), a 61-character name, an unknown kind and extra fields', () => {
    expect(createCategory.safeParse({ name: '', kind: 'expense' }).success).toBe(false);
    expect(createCategory.safeParse({ name: '   ', kind: 'expense' }).success).toBe(false);
    expect(createCategory.safeParse({ name: 'x'.repeat(61), kind: 'expense' }).success).toBe(false);
    expect(createCategory.safeParse({ name: 'Food', kind: 'other' }).success).toBe(false);
    expect(createCategory.safeParse({ name: 'Food' }).success).toBe(false);
    expect(createCategory.safeParse({ name: 'Food', kind: 'expense', extra: 1 }).success).toBe(false);
    expect(updateCategory.safeParse({ name: 'Food', extra: 1 }).success).toBe(false);
    expect(updateCategory.safeParse({ name: 'x'.repeat(61) }).success).toBe(false);
    expect(updateCategory.safeParse({ kind: 'other' }).success).toBe(false);
  });

  it('T-006 update needs at least one field', () => {
    expect(updateCategory.safeParse({}).success).toBe(false);
    expect(updateCategory.safeParse({ kind: 'income' }).success).toBe(true);
  });

  it('T-006 params need an integer id and the response schema is strict', () => {
    expect(categoryParams.parse({ id: '12' })).toEqual({ id: 12 });
    expect(categoryParams.safeParse({ id: 'abc' }).success).toBe(false);
    expect(categoryParams.safeParse({ id: '1.5' }).success).toBe(false);
    expect(categoryParams.safeParse({ id: '1', extra: 'x' }).success).toBe(false);
    expect(category.safeParse({ id: 1, name: 'Food', kind: 'expense', createdAt: 'now', userId: 2 }).success).toBe(false);
  });
});
