function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  for (const v of [e.code, e.status, e.response?.status]) {
    const n = typeof v === 'string' ? Number(v) : v;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return undefined;
}

function isRetryable(err: unknown, only429: boolean): boolean {
  const s = statusOf(err);
  if (only429) return s === 429;
  if (s === undefined) {
    // network errors (ECONNRESET, ETIMEDOUT, fetch failed) have no HTTP status
    const code = (err as { code?: unknown })?.code;
    return typeof code === 'string' && /^E[A-Z]+/.test(code);
  }
  return s === 429 || s >= 500;
}

/** `only429`: for non-idempotent writes — retry only when Google certainly did not apply the request. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; only429?: boolean } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 500;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err, opts.only429 ?? false)) throw err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt));
    }
  }
}
