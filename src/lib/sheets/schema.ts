import { z } from 'zod';
import {
  SOURCES,
  STATUSES,
  type Application,
  type HistoryEntry,
  type Source,
  type VaultItem,
  type VaultSection,
} from '@/lib/domain/types';

export type TabName = 'applications' | 'history' | 'vault_sections' | 'vault_items';

export const TAB_NAMES: TabName[] = ['applications', 'history', 'vault_sections', 'vault_items'];

export const TAB_HEADERS: Record<TabName, string[]> = {
  applications: [
    'id',
    'applied_at',
    'company',
    'position',
    'url',
    'source',
    'status',
    'interview_stage',
    'next_event_at',
    'salary_asked',
    'salary_listed',
    'contact',
    'notes',
    'created_at',
    'updated_at',
  ],
  history: ['id', 'application_id', 'status', 'interview_stage', 'at', 'note'],
  vault_sections: ['id', 'name', 'order'],
  vault_items: ['id', 'section_id', 'type', 'title', 'content', 'tags', 'order'],
};

function toRecord(tab: TabName, row: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  TAB_HEADERS[tab].forEach((h, i) => {
    rec[h] = row[i] ?? '';
  });
  return rec;
}

function fromRecord(tab: TabName, rec: Record<string, string | number | null>): string[] {
  return TAB_HEADERS[tab].map((h) => {
    const v = rec[h];
    return v === null || v === undefined ? '' : String(v);
  });
}

const id = z.string().trim().min(1);
const status = z.enum(STATUSES as [string, ...string[]]);
const nullableInt = z
  .string()
  .transform((s) => (s.trim() === '' ? null : Number(s)))
  .pipe(z.number().int().positive().nullable());
const int = z
  .string()
  .transform((s) => (s.trim() === '' ? 0 : Number(s)))
  .pipe(z.number().int());
const nullableStr = z.string().transform((s) => (s.trim() === '' ? null : s));

const applicationSchema = z.object({
  id,
  applied_at: z.string(),
  company: z.string(),
  position: z.string(),
  url: z.string(),
  source: z.string().transform((s): Source => ((SOURCES as readonly string[]).includes(s) ? (s as Source) : 'other')),
  status,
  interview_stage: nullableInt,
  next_event_at: nullableStr,
  salary_asked: z.string(),
  salary_listed: z.string(),
  contact: z.string(),
  notes: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function applicationFromRow(row: string[]): Application | null {
  const r = applicationSchema.safeParse(toRecord('applications', row));
  if (!r.success) return null;
  const d = r.data;
  return {
    id: d.id,
    appliedAt: d.applied_at,
    company: d.company,
    position: d.position,
    url: d.url,
    source: d.source,
    status: d.status as Application['status'],
    interviewStage: d.interview_stage,
    nextEventAt: d.next_event_at,
    salaryAsked: d.salary_asked,
    salaryListed: d.salary_listed,
    contact: d.contact,
    notes: d.notes,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

export function applicationToRow(a: Application): string[] {
  return fromRecord('applications', {
    id: a.id,
    applied_at: a.appliedAt,
    company: a.company,
    position: a.position,
    url: a.url,
    source: a.source,
    status: a.status,
    interview_stage: a.interviewStage,
    next_event_at: a.nextEventAt,
    salary_asked: a.salaryAsked,
    salary_listed: a.salaryListed,
    contact: a.contact,
    notes: a.notes,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  });
}

const historySchema = z.object({
  id,
  application_id: id,
  status,
  interview_stage: nullableInt,
  at: z.string(),
  note: z.string(),
});

export function historyFromRow(row: string[]): HistoryEntry | null {
  const r = historySchema.safeParse(toRecord('history', row));
  if (!r.success) return null;
  const d = r.data;
  return {
    id: d.id,
    applicationId: d.application_id,
    status: d.status as HistoryEntry['status'],
    interviewStage: d.interview_stage,
    at: d.at,
    note: d.note,
  };
}

export function historyToRow(h: HistoryEntry): string[] {
  return fromRecord('history', {
    id: h.id,
    application_id: h.applicationId,
    status: h.status,
    interview_stage: h.interviewStage,
    at: h.at,
    note: h.note,
  });
}

const sectionSchema = z.object({ id, name: z.string(), order: int });

export function sectionFromRow(row: string[]): VaultSection | null {
  const r = sectionSchema.safeParse(toRecord('vault_sections', row));
  return r.success ? { id: r.data.id, name: r.data.name, order: r.data.order } : null;
}

export function sectionToRow(s: VaultSection): string[] {
  return fromRecord('vault_sections', { id: s.id, name: s.name, order: s.order });
}

const itemSchema = z.object({
  id,
  section_id: id,
  type: z.enum(['link', 'text']),
  title: z.string(),
  content: z.string(),
  tags: z.string().transform((s) =>
    s
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  ),
  order: int,
});

export function itemFromRow(row: string[]): VaultItem | null {
  const r = itemSchema.safeParse(toRecord('vault_items', row));
  if (!r.success) return null;
  const d = r.data;
  return { id: d.id, sectionId: d.section_id, type: d.type, title: d.title, content: d.content, tags: d.tags, order: d.order };
}

export function itemToRow(i: VaultItem): string[] {
  return fromRecord('vault_items', {
    id: i.id,
    section_id: i.sectionId,
    type: i.type,
    title: i.title,
    content: i.content,
    tags: i.tags.join(', '),
    order: i.order,
  });
}

export function parseRows<T>(rows: string[][], fromRow: (r: string[]) => T | null, tab: TabName): T[] {
  const out: T[] = [];
  rows.forEach((row, i) => {
    if (row.every((c) => (c ?? '').trim() === '')) return;
    const parsed = fromRow(row);
    if (parsed === null) {
      // +2: header row and 1-based numbering
      console.warn(`[sheets] skipped invalid row ${i + 2} in tab "${tab}"`);
      return;
    }
    out.push(parsed);
  });
  return out;
}
