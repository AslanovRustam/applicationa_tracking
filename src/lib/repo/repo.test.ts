import { describe, expect, it, vi } from 'vitest';
import { makeApp } from '@/lib/domain/test-helpers';
import { createMemorySheetsClient } from '@/lib/sheets/memory-client';
import { applicationToRow, sectionToRow, itemToRow } from '@/lib/sheets/schema';
import { NotFoundError } from '@/lib/sheets/client';
import { createRepo } from './repo';

const now = new Date('2026-08-13T22:30:00Z'); // 2026-08-14 01:30 in Kyiv

function seqIds() {
  let n = 0;
  return () => `id${++n}`;
}

describe('applications', () => {
  it('creates an application with Kyiv date, detected source and a sent history entry', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const { application, history } = await repo.createApplication(
      { company: 'GR8_TECH', position: 'Senior Front End Developer', url: 'https://djinni.co/jobs/838834' },
      now,
    );
    expect(application).toMatchObject({
      id: 'id1',
      appliedAt: '2026-08-14',
      source: 'djinni',
      status: 'sent',
      interviewStage: null,
      createdAt: now.toISOString(),
    });
    expect(history).toMatchObject({ applicationId: 'id1', status: 'sent', at: '2026-08-14' });
    const all = await repo.loadAll();
    expect(all.applications).toHaveLength(1);
    expect(all.history).toHaveLength(1);
  });

  it('keeps an explicitly chosen source', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const { application } = await repo.createApplication(
      { company: 'X', position: 'Y', url: 'https://djinni.co/jobs/1', source: 'linkedin' },
      now,
    );
    expect(application.source).toBe('linkedin');
  });

  it('rejects empty company or position and writes nothing', async () => {
    const client = createMemorySheetsClient();
    const repo = createRepo(client, seqIds());
    await expect(repo.createApplication({ company: '  ', position: 'Dev', url: '' }, now)).rejects.toThrow();
    await expect(repo.createApplication({ company: 'X', position: '', url: '' }, now)).rejects.toThrow();
    expect((await repo.loadAll()).applications).toEqual([]);
  });

  it('changes status, writes history and updates the application', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const { application } = await repo.createApplication({ company: 'Akvelon', position: 'FE', url: '' }, now);
    const later = new Date('2026-10-16T09:00:00Z');
    const res = await repo.changeStatus(
      application.id,
      { status: 'interview', interviewStage: 2, at: '2026-10-16', note: 'техническое' },
      later,
    );
    expect(res.application).toMatchObject({ status: 'interview', interviewStage: 2, updatedAt: later.toISOString() });
    expect(res.history).toMatchObject({ status: 'interview', interviewStage: 2, at: '2026-10-16', note: 'техническое' });
    expect((await repo.loadAll()).history).toHaveLength(2);
  });

  it('clears the interview stage on the application when leaving interview', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const { application } = await repo.createApplication({ company: 'A', position: 'B', url: '' }, now);
    await repo.changeStatus(application.id, { status: 'interview', interviewStage: 1, at: '2026-09-01', note: '' }, now);
    const res = await repo.changeStatus(application.id, { status: 'rejected', interviewStage: 1, at: '2026-09-05', note: '' }, now);
    expect(res.application.interviewStage).toBeNull();
    expect(res.history.status).toBe('rejected');
  });

  it('updates editable fields', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const { application } = await repo.createApplication({ company: 'A', position: 'B', url: '' }, now);
    const updated = await repo.updateApplication(application.id, { notes: 'позвонить', nextEventAt: '2026-08-20T14:00' }, now);
    expect(updated).toMatchObject({ notes: 'позвонить', nextEventAt: '2026-08-20T14:00' });
  });

  it('marks several applications as ghosted in one update and one append', async () => {
    const client = createMemorySheetsClient({
      applications: [applicationToRow(makeApp({ id: 'a' })), applicationToRow(makeApp({ id: 'b' }))],
    });
    const update = vi.spyOn(client, 'updateRows');
    const append = vi.spyOn(client, 'append');
    const repo = createRepo(client, seqIds());
    const res = await repo.markGhosted(['a', 'b'], new Date('2026-11-23T10:00:00Z'));
    expect(res.applications.map((a) => a.status)).toEqual(['ghosted', 'ghosted']);
    expect(res.history.map((h) => h.at)).toEqual(['2026-11-23', '2026-11-23']);
    expect(update).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('deletes an application together with its history', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const a = await repo.createApplication({ company: 'A', position: 'B', url: '' }, now);
    const b = await repo.createApplication({ company: 'C', position: 'D', url: '' }, now);
    await repo.changeStatus(a.application.id, { status: 'rejected', interviewStage: null, at: '2026-09-01', note: '' }, now);
    await repo.deleteApplication(a.application.id);
    const all = await repo.loadAll();
    expect(all.applications.map((x) => x.id)).toEqual([b.application.id]);
    expect(all.history.every((h) => h.applicationId === b.application.id)).toBe(true);
  });

  it('throws NotFoundError for unknown ids', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    await expect(repo.updateApplication('nope', { notes: 'x' }, now)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('skips broken rows when loading', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = applicationToRow(makeApp({ id: 'bad' }));
    bad[6] = 'реджект';
    const repo = createRepo(
      createMemorySheetsClient({ applications: [applicationToRow(makeApp({ id: 'ok' })), bad] }),
      seqIds(),
    );
    expect((await repo.loadAll()).applications.map((a) => a.id)).toEqual(['ok']);
  });
});

describe('vault', () => {
  it('creates sections at the end of the order', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const a = await repo.createSection('Ссылки');
    const b = await repo.createSection('Шаблоны');
    expect([a.order, b.order]).toEqual([0, 1]);
  });

  it('renames a section', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const s = await repo.createSection('Ссылки');
    expect((await repo.renameSection(s.id, 'Мои ссылки')).name).toBe('Мои ссылки');
  });

  it('deletes a section with its items', async () => {
    const client = createMemorySheetsClient({
      vault_sections: [sectionToRow({ id: 's1', name: 'A', order: 0 }), sectionToRow({ id: 's2', name: 'B', order: 1 })],
      vault_items: [
        itemToRow({ id: 'i1', sectionId: 's1', type: 'link', title: 'x', content: 'y', tags: [], order: 0 }),
        itemToRow({ id: 'i2', sectionId: 's2', type: 'link', title: 'x', content: 'y', tags: [], order: 0 }),
      ],
    });
    const repo = createRepo(client, seqIds());
    await repo.deleteSection('s1');
    const all = await repo.loadAll();
    expect(all.sections.map((s) => s.id)).toEqual(['s2']);
    expect(all.items.map((i) => i.id)).toEqual(['i2']);
  });

  it('reorders sections', async () => {
    const client = createMemorySheetsClient({
      vault_sections: ['a', 'b', 'c'].map((id, order) => sectionToRow({ id, name: id, order })),
    });
    const repo = createRepo(client, seqIds());
    const res = await repo.reorderSections(['c', 'a', 'b']);
    expect(res.map((s) => [s.id, s.order])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('creates, updates, reorders and deletes items', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const s = await repo.createSection('Шаблоны');
    const i1 = await repo.createItem({ sectionId: s.id, type: 'text', title: 'Cover', content: 'Hi {компания}', tags: ['EN'] });
    const i2 = await repo.createItem({ sectionId: s.id, type: 'link', title: 'GitHub', content: 'https://github.com/x', tags: [] });
    expect([i1.order, i2.order]).toEqual([0, 1]);
    expect((await repo.updateItem(i1.id, { title: 'Cover EN' })).title).toBe('Cover EN');
    const reordered = await repo.reorderItems(s.id, [i2.id, i1.id]);
    expect(reordered.map((i) => [i.id, i.order])).toEqual([
      [i2.id, 0],
      [i1.id, 1],
    ]);
    await repo.deleteItem(i1.id);
    expect((await repo.loadAll()).items.map((i) => i.id)).toEqual([i2.id]);
  });

  it('rejects an item with an empty title', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const s = await repo.createSection('Шаблоны');
    await expect(repo.createItem({ sectionId: s.id, type: 'text', title: ' ', content: 'x', tags: [] })).rejects.toThrow();
  });
});

describe('idempotent creates', () => {
  it('creating the same application id twice stores it once', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    const input = { id: 'client-1', company: 'A', position: 'B', url: '' };
    await repo.createApplication(input, now);
    const second = await repo.createApplication(input, now);
    expect(second.application.id).toBe('client-1');
    const all = await repo.loadAll();
    expect(all.applications).toHaveLength(1);
    expect(all.history).toHaveLength(1);
  });

  it('a retry after a failed history write completes without duplicating the application', async () => {
    const client = createMemorySheetsClient();
    const realAppend = client.append.bind(client);
    let failHistory = true;
    client.append = async (tab, rows) => {
      if (tab === 'history' && failHistory) {
        failHistory = false;
        throw new Error('boom');
      }
      return realAppend(tab, rows);
    };
    const repo = createRepo(client, seqIds());
    const input = { id: 'client-2', company: 'A', position: 'B', url: '' };
    await expect(repo.createApplication(input, now)).rejects.toThrow('boom');
    await repo.createApplication(input, now);
    const all = await repo.loadAll();
    expect(all.applications).toHaveLength(1);
    expect(all.history).toHaveLength(1);
  });

  it('creating the same section and item ids twice stores each once', async () => {
    const repo = createRepo(createMemorySheetsClient(), seqIds());
    await repo.createSection('Ссылки', 'sec-1');
    await repo.createSection('Ссылки', 'sec-1');
    const item = { id: 'item-1', sectionId: 'sec-1', type: 'link' as const, title: 'GH', content: 'https://github.com', tags: [] };
    await repo.createItem(item);
    await repo.createItem(item);
    const all = await repo.loadAll();
    expect(all.sections).toHaveLength(1);
    expect(all.items).toHaveLength(1);
  });
});
