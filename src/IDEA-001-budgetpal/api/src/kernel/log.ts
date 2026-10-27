import type { LoggerOptions } from 'pino';
import type { Config } from './config.js';

/**
 * Paths pino removes from every log line. Fastify's default serializers never
 * emit request or response bodies; the body paths are a second guard.
 */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  'req.body',
  'res.body',
  'body',
  'headers.cookie',
  'headers.authorization',
];

export function buildLoggerOptions(config: Pick<Config, 'logLevel'>): LoggerOptions {
  return {
    level: config.logLevel,
    redact: { paths: REDACT_PATHS, remove: true },
    serializers: {
      // Allow-list: only these request fields are ever logged (no headers, no query string).
      req(request: { method?: string; url?: string }) {
        return { method: request.method, url: request.url?.split('?')[0] };
      },
    },
  };
}
