import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';

/** D-06: Argon2id at the OWASP floor, m = 19 MiB, t = 2, p = 1. */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; reason: 'too-short' | 'too-long' | 'common'; message: string };

const COMMON_FILE = fileURLToPath(new URL('./common-passwords.txt', import.meta.url));

let common: Set<string> | undefined;

function normalise(password: string): string {
  return password.normalize('NFKC').toLowerCase();
}

/** Loaded once. A missing list is an error, never a silently empty one (the policy must not weaken). */
function commonPasswords(): Set<string> {
  if (!common) {
    const text = readFileSync(COMMON_FILE, 'utf8');
    common = new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'))
        .map(normalise),
    );
  }
  return common;
}

/**
 * Length 15 to 128 characters (code points) and not on the bundled common-password list.
 * No composition rules: spaces and a lack of symbols are fine.
 */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: 'too-short', message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return { ok: false, reason: 'too-long', message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  if (commonPasswords().has(normalise(password))) {
    return { ok: false, reason: 'common', message: 'Password is too common; choose another.' };
  }
  return { ok: true };
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/** False for a wrong password and for a malformed stored hash; never throws on bad input. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
