import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/kernel/config.js';

describe('loadConfig', () => {
  it('T-005 returns the defaults and parses valid values', () => {
    const defaults = loadConfig({});
    expect(defaults).toMatchObject({
      port: 3000,
      logLevel: 'info',
      currency: 'USD',
      cookieSecure: false,
      sessionSecret: undefined,
      sessionIdleHours: 24,
      sessionAbsoluteDays: 30,
    });

    const secret = 's'.repeat(32);
    const parsed = loadConfig({
      PORT: '8081',
      DATABASE_PATH: '/data/x.db',
      SESSION_SECRET: secret,
      CURRENCY: 'EUR',
      LOG_LEVEL: 'debug',
      COOKIE_SECURE: 'true',
      SESSION_IDLE_HOURS: '12',
      SESSION_ABSOLUTE_DAYS: '7',
    });
    expect(parsed).toEqual({
      port: 8081,
      databasePath: '/data/x.db',
      sessionSecret: secret,
      currency: 'EUR',
      logLevel: 'debug',
      cookieSecure: true,
      sessionIdleHours: 12,
      sessionAbsoluteDays: 7,
    });
  });

  it('T-005 treats the empty values of an unfilled .env as unset', () => {
    const config = loadConfig({
      PORT: '',
      DATABASE_PATH: '',
      SESSION_SECRET: '',
      CURRENCY: '',
      LOG_LEVEL: '',
      COOKIE_SECURE: '',
      SESSION_IDLE_HOURS: '',
      SESSION_ABSOLUTE_DAYS: '',
    });
    expect(config.port).toBe(3000);
    expect(config.sessionSecret).toBeUndefined();
    expect(config.cookieSecure).toBe(false);
    expect(config.sessionIdleHours).toBe(24);
    expect(config.sessionAbsoluteDays).toBe(30);
  });

  it.each([
    ['PORT', 'not-a-port'],
    ['PORT', '70000'],
    ['LOG_LEVEL', 'loud'],
    ['SESSION_SECRET', 'too-short-secret-value'],
    ['COOKIE_SECURE', 'yes'],
    ['CURRENCY', 'dollars'],
    ['SESSION_IDLE_HOURS', '0'],
    ['SESSION_ABSOLUTE_DAYS', 'forever'],
  ])('T-006 rejects invalid %s and names the variable, not the value', (name, value) => {
    let thrown: unknown;
    try {
      loadConfig({ [name]: value });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConfigError);
    const error = thrown as ConfigError;
    expect(error.message).toContain(name);
    expect(error.variables).toEqual([name]);
    expect(error.message).not.toContain(value);
  });
});
