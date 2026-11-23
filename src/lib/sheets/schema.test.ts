import { describe, expect, it, vi } from 'vitest';
import { makeApp, makeHistory } from '@/lib/domain/test-helpers';
import type { VaultItem, VaultSection } from '@/lib/domain/types';
import {
  TAB_HEADERS,
  applicationFromRow,
  applicationToRow,
  historyFromRow,
  historyToRow,
  itemFromRow,
  itemToRow,
  parseRows,
  sectionFromRow,
  sectionToRow,
} from './schema';

describe('applications rows', () => {
  it('round-trips a full application', () => {
    const a = makeApp({
      status: 'interview',
      interviewStage: 2,
      nextEventAt: '2026-11-24T14:00',
      salaryAsked: '3000$',
      salaryListed: '4000–6000$',
      contact: 'Анна, @anna',
      notes: 'многострочная\nзаметка',
    });
    expect(applicationFromRow(applicationToRow(a))).toEqual(a);
  });

  it('round-trips nulls', () => {
    const a = makeApp({ interviewStage: null, nextEventAt: null });
    expect(applicationFromRow(applicationToRow(a))).toEqual(a);
  });

  it('writes columns in header order with id first', () => {
    const row = applicationToRow(makeApp({ id: 'x' }));
    expect(row).toHaveLength(TAB_HEADERS.applications.length);
    expect(row[0]).toBe('x');
  });

  it('reads short rows (Google trims trailing empty cells)', () => {
    const full = applicationToRow(makeApp({ notes: '', salaryAsked: '' }));
    const short = full.slice(0, 9);
    const parsed = applicationFromRow(short);
    expect(parsed).not.toBeNull();
    expect(parsed!.notes).toBe('');
    expect(parsed!.createdAt).toBe('');
  });

  it('rejects a row without id', () => {
    const row = applicationToRow(makeApp());
    row[0] = '';
    expect(applicationFromRow(row)).toBeNull();
  });

  it('rejects an unknown status', () => {
    const row = applicationToRow(makeApp());
    row[TAB_HEADERS.applications.indexOf('status')] = 'реджект';
    expect(applicationFromRow(row)).toBeNull();
  });

  it('keeps the row but falls back to other for an unknown source', () => {
    const row = applicationToRow(makeApp());
    row[TAB_HEADERS.applications.indexOf('source')] = 'unknown';
    expect(applicationFromRow(row)?.source).toBe('other');
  });
});

describe('history rows', () => {
  it('round-trips', () => {
    const h = makeHistory({ status: 'interview', interviewStage: 2, at: '2026-10-16', note: 'техническое' });
    expect(historyFromRow(historyToRow(h))).toEqual(h);
  });
});

describe('vault rows', () => {
  it('round-trips a section', () => {
    const s: VaultSection = { id: 's1', name: 'Ссылки', order: 2 };
    expect(sectionFromRow(sectionToRow(s))).toEqual(s);
  });

  it('writes tags comma-separated and reads them back', () => {
    const i: VaultItem = { id: 'i1', sectionId: 's1', type: 'text', title: 'Cover', content: 'Hi {компания}', tags: ['EN', 'cover'], order: 0 };
    const row = itemToRow(i);
    expect(row[TAB_HEADERS.vault_items.indexOf('tags')]).toBe('EN, cover');
    expect(itemFromRow(row)).toEqual(i);
  });

  it('reads empty tags as an empty list', () => {
    const row = itemToRow({ id: 'i1', sectionId: 's1', type: 'link', title: 'GitHub', content: 'https://github.com/x', tags: [], order: 0 });
    expect(itemFromRow(row)?.tags).toEqual([]);
  });

  it('rejects an unknown item type', () => {
    const row = itemToRow({ id: 'i1', sectionId: 's1', type: 'link', title: 'x', content: 'y', tags: [], order: 0 });
    row[TAB_HEADERS.vault_items.indexOf('type')] = 'video';
    expect(itemFromRow(row)).toBeNull();
  });
});

describe('parseRows', () => {
  it('skips broken rows and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const good1 = applicationToRow(makeApp({ id: '1' }));
    const bad = applicationToRow(makeApp({ id: '' }));
    const good2 = applicationToRow(makeApp({ id: '2' }));
    const result = parseRows([good1, bad, good2], applicationFromRow, 'applications');
    expect(result.map((a) => a.id)).toEqual(['1', '2']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('ignores fully empty rows silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseRows([[], ['', '']], applicationFromRow, 'applications')).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('parseRows duplicate ids', () => {
  it('keeps only the last row for a duplicated id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = applicationToRow(makeApp({ id: 'dup', notes: 'old' }));
    const other = applicationToRow(makeApp({ id: 'x' }));
    const last = applicationToRow(makeApp({ id: 'dup', notes: 'new' }));
    const result = parseRows([first, other, last], applicationFromRow, 'applications');
    expect(result.map((a) => [a.id, a.notes])).toEqual([
      ['x', ''],
      ['dup', 'new'],
    ]);
    warn.mockRestore();
  });
});
