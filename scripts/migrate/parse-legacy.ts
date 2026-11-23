import { detectSource, extractFirstUrl } from '../../src/lib/domain/source';
import type { Application, HistoryEntry, Status } from '../../src/lib/domain/types';

export interface LegacyRow {
  rowNumber: number;
  date: string;
  company: string;
  link: string;
  position: string;
  salary: string;
  s1: string;
  s2: string;
  s3: string;
}

export interface ParsedLegacy {
  application: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>;
  /** First entry is always `sent` on appliedAt. */
  history: Omit<HistoryEntry, 'id' | 'applicationId'>[];
  /** Reasons to check the row by hand; empty when clean. */
  review: string[];
}

type Entry = ParsedLegacy['history'][number];

// "02,09" / "30.10" / "9.11" or "1109" (DDMM glued to text)
const DATE_RE = /(?<!\d)(\d{1,2})[.,](\d{1,2})(?![\d.,]\d)|(?<!\d)(\d{2})(\d{2})(?!\d)/;
const URL_RE = /https?:\/\/\S+/gi;
const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** First day.month in the text → ISO date, in the application's year (or the next one if earlier). */
export function parseLegacyDayMonth(text: string, appliedAt: string): string | null {
  const m = text.replace(URL_RE, ' ').match(DATE_RE);
  if (!m) return null;
  const day = Number(m[1] ?? m[3]);
  const month = Number(m[2] ?? m[4]);
  const year = Number(appliedAt.slice(0, 4));
  const date = validDate(year, month, day);
  if (!date) return null;
  return date < appliedAt ? validDate(year + 1, month, day) : date;
}

function parseAppliedAt(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? validDate(Number(m[3]), Number(m[2]), Number(m[1])) : null;
}

const cleanNote = (s: string) => s.replace(/^[\s\-–—,.:;]+|[\s\-–—,.:;]+$/g, '').trim();

function parseStageCell(
  text: string,
  stage: 1 | 2 | 3,
  appliedAt: string,
  notes: string[],
  review: string[],
): Entry | null {
  const urls = text.match(URL_RE) ?? [];
  if (urls.length) notes.push(`${stage} собес: ${urls.join(' ')}`);
  const rest = text.replace(URL_RE, ' ').replace(/\s+/g, ' ').trim();
  if (!rest) return null;

  const date = parseLegacyDayMonth(rest, appliedAt);
  const withoutDate = rest.replace(DATE_RE, ' ');

  if (/реджект|отказ/i.test(rest)) {
    return {
      status: 'rejected',
      interviewStage: null,
      at: date ?? appliedAt,
      note: cleanNote(withoutDate.replace(/реджект|отказ/gi, ' ').replace(/\s+/g, ' ')),
    };
  }
  if (/закры|звкры/i.test(rest)) {
    return { status: 'rejected', interviewStage: null, at: date ?? appliedAt, note: date ? 'вакансия закрыта' : `вакансия закрыта; ${rest}` };
  }
  const dateOnly = date !== null && cleanNote(withoutDate) === '';
  if (date && (dateOnly || stage > 1)) {
    return { status: 'interview', interviewStage: stage, at: date, note: cleanNote(withoutDate) };
  }
  if (!date) review.push(`${stage} собес: не найдена дата в «${rest}» — поставлена дата отклика`);
  return { status: 'screening', interviewStage: null, at: date ?? appliedAt, note: rest };
}

export function parseLegacyRow(row: LegacyRow, fallbackDate?: string): ParsedLegacy | null {
  if (![row.date, row.company, row.link, row.position].some((c) => c.trim())) return null;
  const review: string[] = [];
  const notes: string[] = [];

  let appliedAt = parseAppliedAt(row.date);
  if (!appliedAt) {
    review.push(`непонятная дата «${row.date}»${fallbackDate ? ` — взята ${fallbackDate}` : ''}`);
    appliedAt = fallbackDate ?? '';
  }

  const link = row.link.trim();
  const url = extractFirstUrl(link) ?? '';
  if (link && link !== url) notes.push(`Ссылки: ${link}`);
  if (/https?:\/\//i.test(row.company)) review.push('в колонке «компания» ссылка');
  if (/https?:\/\//i.test(row.position)) review.push('в колонке «должность» ссылка');
  if (!row.company.trim()) review.push('не указана компания');
  if (!row.position.trim()) review.push('не указана должность');

  const history: Entry[] = [{ status: 'sent', interviewStage: null, at: appliedAt, note: '' }];
  ([row.s1, row.s2, row.s3] as const).forEach((cell, i) => {
    if (!cell.trim()) return;
    const entry = parseStageCell(cell, (i + 1) as 1 | 2 | 3, appliedAt, notes, review);
    if (entry) history.push(entry);
  });

  // stable: equal dates keep s1 → s2 → s3 order
  const ordered = history
    .map((h, i) => ({ h, i }))
    .sort((a, b) => a.h.at.localeCompare(b.h.at) || a.i - b.i)
    .map((x) => x.h);
  const last = ordered[ordered.length - 1];
  const status: Status = last.status;

  return {
    application: {
      appliedAt,
      company: row.company.trim(),
      position: row.position.trim(),
      url,
      source: detectSource(url),
      status,
      interviewStage: status === 'interview' ? last.interviewStage : null,
      nextEventAt: null,
      salaryAsked: row.salary.trim(),
      salaryListed: '',
      contact: '',
      notes: notes.join('\n'),
    },
    history: ordered,
    review,
  };
}

/** A row needs at least a company or a position to become an application. */
export function isImportable(p: ParsedLegacy): boolean {
  return Boolean(p.application.company || p.application.position);
}

export function parseLegacyVault(
  headerCellI: string,
  cellsI: string[],
): { links: { title: string; url: string }[]; texts: { title: string; content: string }[] } {
  const links: { title: string; url: string }[] = [];
  const texts: { title: string; content: string }[] = [];
  for (const raw of [headerCellI, ...cellsI]) {
    const cell = raw.trim();
    if (!cell) continue;
    const url = extractFirstUrl(cell);
    if (url && url === cell) {
      let title = url;
      try {
        title = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        // keep the raw url as title
      }
      links.push({ title, url });
    } else {
      texts.push({ title: cell.split('\n')[0].trim().slice(0, 40), content: cell });
    }
  }
  return { links, texts };
}
