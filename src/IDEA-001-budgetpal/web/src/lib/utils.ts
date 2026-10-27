import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names, drops falsy values and lets the last conflicting Tailwind class win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
