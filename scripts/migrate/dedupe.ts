export function dedupeKey(a: { company: string; url: string; appliedAt: string }): string {
  return [a.company.trim().toLowerCase(), a.url.trim().toLowerCase().replace(/\/+$/, ''), a.appliedAt].join('|');
}
