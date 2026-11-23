import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withRetry } from './retry';

function failing(errors: unknown[], result = 'ok') {
  let calls = 0;
  const fn = async () => {
    const e = errors[calls];
    calls++;
    if (e !== undefined) throw e;
    return result;
  };
  return { fn, calls: () => calls };
}

describe('withRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries on 429 and returns the result', async () => {
    const f = failing([{ code: 429 }, { code: 429 }]);
    const p = withRetry(f.fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('ok');
    expect(f.calls()).toBe(3);
  });

  it('gives up after retries on 5xx and throws the last error', async () => {
    const errs = [{ code: 500 }, { code: 502 }, { code: 503 }, { code: 500, last: true }];
    const f = failing(errs);
    const p = withRetry(f.fn);
    const assertion = expect(p).rejects.toEqual({ code: 500, last: true });
    await vi.runAllTimersAsync();
    await assertion;
    expect(f.calls()).toBe(4);
  });

  it('does not retry client errors', async () => {
    const f = failing([{ code: 400 }]);
    const p = withRetry(f.fn);
    const assertion = expect(p).rejects.toEqual({ code: 400 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(f.calls()).toBe(1);
  });

  it('reads status from googleapis-style errors', async () => {
    const f = failing([{ response: { status: 429 } }]);
    const p = withRetry(f.fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('ok');
    expect(f.calls()).toBe(2);
  });
});

describe('withRetry only429', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not retry 5xx for non-idempotent writes', async () => {
    const f = failing([{ code: 500 }]);
    const p = withRetry(f.fn, { only429: true });
    const assertion = expect(p).rejects.toEqual({ code: 500 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(f.calls()).toBe(1);
  });

  it('still retries 429 (request was not applied)', async () => {
    const f = failing([{ code: 429 }]);
    const p = withRetry(f.fn, { only429: true });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('ok');
  });
});
