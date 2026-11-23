export const TZ = 'Europe/Kyiv';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function kyivParts(now: Date): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(now)) parts[p.type] = p.value;
  return parts;
}

/** 'YYYY-MM-DD' in Kyiv */
export function todayInKyiv(now: Date): string {
  const p = kyivParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 'YYYY-MM-DDTHH:mm' in Kyiv */
export function nowInKyiv(now: Date): string {
  const p = kyivParts(now);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** '2026-08-14' or '2026-08-14T10:00' -> '14.08' */
export function formatShortDate(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

/** '2026-08-14T10:00' -> '14.08, 10:00' */
export function formatShortDateTime(dateTime: string): string {
  const time = dateTime.length > 10 ? dateTime.slice(11, 16) : '';
  return time ? `${formatShortDate(dateTime)}, ${time}` : formatShortDate(dateTime);
}
