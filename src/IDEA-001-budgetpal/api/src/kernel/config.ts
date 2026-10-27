import { z } from 'zod';

/** Empty strings (an unfilled `.env`) count as "not set" so defaults apply. */
const blankToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const envSchema = z.object({
  PORT: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(65535).default(3000)),
  DATABASE_PATH: z.preprocess(blankToUndefined, z.string().min(1).default('./data/budgetpal.db')),
  SESSION_SECRET: z.preprocess(blankToUndefined, z.string().min(32).optional()),
  CURRENCY: z.preprocess(blankToUndefined, z.string().regex(/^[A-Z]{3}$/).default('USD')),
  LOG_LEVEL: z.preprocess(blankToUndefined, z.enum(LOG_LEVELS).default('info')),
  COOKIE_SECURE: z.preprocess(
    blankToUndefined,
    z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  ),
});

export interface Config {
  port: number;
  databasePath: string;
  sessionSecret: string | undefined;
  currency: string;
  logLevel: LogLevel;
  cookieSecure: boolean;
}

export class ConfigError extends Error {
  readonly variables: string[];
  constructor(variables: string[]) {
    super(`Invalid configuration: ${variables.join(', ')}`);
    this.name = 'ConfigError';
    this.variables = variables;
  }
}

/**
 * Parses the environment once. Errors name the offending variables and never
 * echo their values (a bad SESSION_SECRET must not reach logs).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? 'environment')))];
    throw new ConfigError(names);
  }
  const parsed = result.data;
  return {
    port: parsed.PORT,
    databasePath: parsed.DATABASE_PATH,
    sessionSecret: parsed.SESSION_SECRET,
    currency: parsed.CURRENCY,
    logLevel: parsed.LOG_LEVEL,
    cookieSecure: parsed.COOKIE_SECURE,
  };
}
