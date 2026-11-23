import { describe, expect, it } from 'vitest';
import { resolveCredentialsJson } from './credentials';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
const key = JSON.stringify({ client_email: 'bot@x.iam.gserviceaccount.com', private_key: 'SECRET-KEY' });
const noFile = () => {
  throw new Error('no file');
};

describe('resolveCredentialsJson', () => {
  it('reads the key file when GOOGLE_SERVICE_ACCOUNT_FILE is set', () => {
    const read = (p: string) => (p === 'key.json' ? key : '');
    expect(resolveCredentialsJson(env({ GOOGLE_SERVICE_ACCOUNT_FILE: 'key.json' }), read)).toBe(key);
  });

  it('accepts multi-line JSON in GOOGLE_SERVICE_ACCOUNT_JSON (e.g. pasted into Vercel)', () => {
    const multiline = JSON.stringify(JSON.parse(key), null, 2);
    expect(resolveCredentialsJson(env({ GOOGLE_SERVICE_ACCOUNT_JSON: multiline }), noFile)).toBe(multiline);
  });

  it('explains a truncated value without echoing the secret', () => {
    let message = '';
    try {
      resolveCredentialsJson(env({ GOOGLE_SERVICE_ACCOUNT_JSON: '{\n  ' }), noFile);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('GOOGLE_SERVICE_ACCOUNT_JSON');
    expect(message).toContain('GOOGLE_SERVICE_ACCOUNT_FILE');
    expect(message).not.toContain('SECRET-KEY');
  });

  it('rejects JSON that is not a service account key', () => {
    expect(() => resolveCredentialsJson(env({ GOOGLE_SERVICE_ACCOUNT_JSON: '{"a":1}' }), noFile)).toThrow(/client_email/);
  });

  it('reports a missing key', () => {
    expect(() => resolveCredentialsJson(env({}), noFile)).toThrow(/GOOGLE_SERVICE_ACCOUNT_FILE/);
  });

  it('reports an unreadable key file', () => {
    expect(() => resolveCredentialsJson(env({ GOOGLE_SERVICE_ACCOUNT_FILE: 'nope.json' }), noFile)).toThrow(/nope\.json/);
  });
});
