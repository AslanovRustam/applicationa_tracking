/** The new spreadsheet has no such tab yet (first run) — the only read error that may be treated as "empty". */
export function isMissingTabError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const err = e as { code?: unknown; status?: unknown; message?: unknown };
  const status = Number(err.code ?? err.status);
  return status === 400 && typeof err.message === 'string' && /Unable to parse range/i.test(err.message);
}
