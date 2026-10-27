import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('SPEC-010 Enabler-002 cn helper', () => {
  it('SPEC-010 T-009 joins class names and drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
    expect(cn(['x', { y: true, z: false }])).toBe('x y');
  });

  it('SPEC-010 T-009 lets the last conflicting Tailwind class win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm text-muted-foreground', 'text-foreground')).toBe('text-sm text-foreground');
    expect(cn('px-2 py-1', 'p-3')).toBe('p-3');
  });

  it('SPEC-010 T-009 keeps non-conflicting classes in order', () => {
    expect(cn('flex', 'items-center', 'gap-2')).toBe('flex items-center gap-2');
  });
});
