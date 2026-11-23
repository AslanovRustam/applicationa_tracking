import { detectSource } from '@/lib/domain/source';
import { todayInKyiv } from '@/lib/domain/time';
import type { Application, HistoryEntry, Status, StatusChange, VaultItem, VaultSection } from '@/lib/domain/types';
import { NotFoundError, type SheetsClient } from '@/lib/sheets/client';
import {
  applicationFromRow,
  applicationToRow,
  historyFromRow,
  historyToRow,
  itemFromRow,
  itemToRow,
  parseRows,
  sectionFromRow,
  sectionToRow,
} from '@/lib/sheets/schema';
import {
  applicationPatchSchema,
  newApplicationSchema,
  newVaultItemSchema,
  sectionNameSchema,
  statusChangeSchema,
  vaultItemPatchSchema,
  type ApplicationPatch,
  type NewApplicationInput,
  type NewVaultItemInput,
  type VaultItemPatch,
} from './inputs';

export interface AllData {
  applications: Application[];
  history: HistoryEntry[];
  sections: VaultSection[];
  items: VaultItem[];
}

export interface Repo {
  loadAll(): Promise<AllData>;
  createApplication(input: NewApplicationInput, now: Date): Promise<{ application: Application; history: HistoryEntry }>;
  updateApplication(id: string, patch: ApplicationPatch, now: Date): Promise<Application>;
  changeStatus(id: string, change: StatusChange, now: Date): Promise<{ application: Application; history: HistoryEntry }>;
  markGhosted(ids: string[], now: Date): Promise<{ applications: Application[]; history: HistoryEntry[] }>;
  deleteApplication(id: string): Promise<void>;
  createSection(name: string, id?: string): Promise<VaultSection>;
  renameSection(id: string, name: string): Promise<VaultSection>;
  deleteSection(id: string): Promise<void>;
  reorderSections(orderedIds: string[]): Promise<VaultSection[]>;
  createItem(input: NewVaultItemInput): Promise<VaultItem>;
  updateItem(id: string, patch: VaultItemPatch): Promise<VaultItem>;
  deleteItem(id: string): Promise<void>;
  reorderItems(sectionId: string, orderedIds: string[]): Promise<VaultItem[]>;
}

function find<T extends { id: string }>(list: T[], id: string, what: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new NotFoundError(`${what} "${id}" not found`);
  return found;
}

export function createRepo(client: SheetsClient, newId: () => string = () => crypto.randomUUID()): Repo {
  const readApplications = async () =>
    parseRows((await client.batchRead(['applications'])).applications, applicationFromRow, 'applications');
  const readSections = async () =>
    parseRows((await client.batchRead(['vault_sections'])).vault_sections, sectionFromRow, 'vault_sections');
  const readItems = async () =>
    parseRows((await client.batchRead(['vault_items'])).vault_items, itemFromRow, 'vault_items');

  function applyStatus(app: Application, change: StatusChange, now: Date): { application: Application; history: HistoryEntry } {
    const status = change.status as Status;
    const application: Application = {
      ...app,
      status,
      interviewStage: status === 'interview' ? change.interviewStage : null,
      updatedAt: now.toISOString(),
    };
    const history: HistoryEntry = {
      id: newId(),
      applicationId: app.id,
      status,
      interviewStage: status === 'interview' ? change.interviewStage : null,
      at: change.at,
      note: change.note,
    };
    return { application, history };
  }

  return {
    async loadAll() {
      const d = await client.batchRead(['applications', 'history', 'vault_sections', 'vault_items']);
      return {
        applications: parseRows(d.applications, applicationFromRow, 'applications'),
        history: parseRows(d.history, historyFromRow, 'history'),
        sections: parseRows(d.vault_sections, sectionFromRow, 'vault_sections'),
        items: parseRows(d.vault_items, itemFromRow, 'vault_items'),
      };
    },

    async createApplication(rawInput, now) {
      const input = newApplicationSchema.parse(rawInput);
      const id = input.id ?? newId();
      const existing = await client.batchRead(['applications', 'history']);
      const prevApp = parseRows(existing.applications, applicationFromRow, 'applications').find((a) => a.id === id);
      const prevHistory = parseRows(existing.history, historyFromRow, 'history').find((h) => h.applicationId === id);
      if (prevApp && prevHistory) return { application: prevApp, history: prevHistory };

      const appliedAt = prevApp?.appliedAt ?? input.appliedAt ?? todayInKyiv(now);
      const application: Application = prevApp ?? {
        id,
        appliedAt,
        company: input.company,
        position: input.position,
        url: input.url,
        source: input.source ?? detectSource(input.url),
        status: 'sent',
        interviewStage: null,
        nextEventAt: null,
        salaryAsked: input.salaryAsked ?? '',
        salaryListed: input.salaryListed ?? '',
        contact: input.contact ?? '',
        notes: input.notes ?? '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      const history: HistoryEntry = {
        id: newId(),
        applicationId: application.id,
        status: 'sent',
        interviewStage: null,
        at: appliedAt,
        note: '',
      };
      if (!prevApp) await client.append('applications', [applicationToRow(application)]);
      await client.append('history', [historyToRow(history)]);
      return { application, history };
    },

    async updateApplication(id, rawPatch, now) {
      const patch = applicationPatchSchema.parse(rawPatch);
      const app = find(await readApplications(), id, 'Application');
      const updated: Application = { ...app, ...patch, updatedAt: now.toISOString() };
      await client.updateRows('applications', [applicationToRow(updated)]);
      return updated;
    },

    async changeStatus(id, rawChange, now) {
      const change = statusChangeSchema.parse(rawChange) as StatusChange;
      const app = find(await readApplications(), id, 'Application');
      const res = applyStatus(app, change, now);
      await client.updateRows('applications', [applicationToRow(res.application)]);
      await client.append('history', [historyToRow(res.history)]);
      return res;
    },

    async markGhosted(ids, now) {
      const apps = await readApplications();
      const at = todayInKyiv(now);
      const results = ids.map((id) =>
        applyStatus(find(apps, id, 'Application'), { status: 'ghosted', interviewStage: null, at, note: '' }, now),
      );
      if (!results.length) return { applications: [], history: [] };
      await client.updateRows('applications', results.map((r) => applicationToRow(r.application)));
      await client.append('history', results.map((r) => historyToRow(r.history)));
      return { applications: results.map((r) => r.application), history: results.map((r) => r.history) };
    },

    async deleteApplication(id) {
      const d = await client.batchRead(['applications', 'history']);
      const apps = parseRows(d.applications, applicationFromRow, 'applications');
      find(apps, id, 'Application');
      const historyIds = parseRows(d.history, historyFromRow, 'history')
        .filter((h) => h.applicationId === id)
        .map((h) => h.id);
      await client.deleteByIds('history', historyIds);
      await client.deleteByIds('applications', [id]);
    },

    async createSection(rawName, clientId) {
      const name = sectionNameSchema.parse(rawName);
      const sections = await readSections();
      const prev = clientId ? sections.find((s) => s.id === clientId) : undefined;
      if (prev) return prev;
      const section: VaultSection = {
        id: clientId || newId(),
        name,
        order: sections.reduce((m, s) => Math.max(m, s.order + 1), 0),
      };
      await client.append('vault_sections', [sectionToRow(section)]);
      return section;
    },

    async renameSection(id, rawName) {
      const name = sectionNameSchema.parse(rawName);
      const updated = { ...find(await readSections(), id, 'Section'), name };
      await client.updateRows('vault_sections', [sectionToRow(updated)]);
      return updated;
    },

    async deleteSection(id) {
      find(await readSections(), id, 'Section');
      const itemIds = (await readItems()).filter((i) => i.sectionId === id).map((i) => i.id);
      await client.deleteByIds('vault_items', itemIds);
      await client.deleteByIds('vault_sections', [id]);
    },

    async reorderSections(orderedIds) {
      const sections = await readSections();
      const updated = orderedIds.map((id, order) => ({ ...find(sections, id, 'Section'), order }));
      await client.updateRows('vault_sections', updated.map(sectionToRow));
      return updated;
    },

    async createItem(rawInput) {
      const input = newVaultItemSchema.parse(rawInput);
      find(await readSections(), input.sectionId, 'Section');
      const all = await readItems();
      const prev = input.id ? all.find((i) => i.id === input.id) : undefined;
      if (prev) return prev;
      const items = all.filter((i) => i.sectionId === input.sectionId);
      const item: VaultItem = { ...input, id: input.id ?? newId(), order: items.reduce((m, i) => Math.max(m, i.order + 1), 0) };
      await client.append('vault_items', [itemToRow(item)]);
      return item;
    },

    async updateItem(id, rawPatch) {
      const patch = vaultItemPatchSchema.parse(rawPatch);
      const updated: VaultItem = { ...find(await readItems(), id, 'Item'), ...patch };
      await client.updateRows('vault_items', [itemToRow(updated)]);
      return updated;
    },

    async deleteItem(id) {
      find(await readItems(), id, 'Item');
      await client.deleteByIds('vault_items', [id]);
    },

    async reorderItems(sectionId, orderedIds) {
      const items = (await readItems()).filter((i) => i.sectionId === sectionId);
      const updated = orderedIds.map((id, order) => ({ ...find(items, id, 'Item'), order }));
      await client.updateRows('vault_items', updated.map(itemToRow));
      return updated;
    },
  };
}
