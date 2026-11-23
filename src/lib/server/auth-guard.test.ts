import { describe, expect, it } from 'vitest';
import { isAllowedEmail, isAuthDisabled } from './auth-guard';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe('isAuthDisabled', () => {
  it('is ignored in production', () => {
    expect(isAuthDisabled(env({ AUTH_DISABLED: 'true', NODE_ENV: 'production' }))).toBe(false);
  });

  it('works in development', () => {
    expect(isAuthDisabled(env({ AUTH_DISABLED: 'true', NODE_ENV: 'development' }))).toBe(true);
  });

  it('is off by default', () => {
    expect(isAuthDisabled(env({ NODE_ENV: 'development' }))).toBe(false);
  });
});

describe('isAllowedEmail', () => {
  const allowed = env({ ALLOWED_EMAIL: 'me@gmail.com' });

  it('accepts the allowed email case-insensitively', () => {
    expect(isAllowedEmail('Me@Gmail.com', true, allowed)).toBe(true);
  });

  it('rejects another email', () => {
    expect(isAllowedEmail('someone@gmail.com', true, allowed)).toBe(false);
  });

  it('rejects an unverified email', () => {
    expect(isAllowedEmail('me@gmail.com', false, allowed)).toBe(false);
  });

  it('rejects everyone when ALLOWED_EMAIL is empty', () => {
    expect(isAllowedEmail('me@gmail.com', true, env({ ALLOWED_EMAIL: '' }))).toBe(false);
    expect(isAllowedEmail('', true, env({ ALLOWED_EMAIL: '' }))).toBe(false);
  });

  it('rejects a missing email', () => {
    expect(isAllowedEmail(null, true, allowed)).toBe(false);
  });
});
