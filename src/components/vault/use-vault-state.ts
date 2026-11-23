'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  createItemAction,
  createSectionAction,
  deleteItemAction,
  deleteSectionAction,
  renameSectionAction,
  reorderItemsAction,
  reorderSectionsAction,
  updateItemAction,
} from '@/app/actions';
import type { VaultItem, VaultSection } from '@/lib/domain/types';
import { sectionOrderAfterDrop, sectionOrderAfterMove } from '@/lib/domain/vault-order';
import type { NewVaultItemInput, VaultItemPatch } from '@/lib/repo/inputs';
import { safeAction } from '@/lib/safe-action';

type Op =
  | { kind: 'createSection'; id: string; name: string }
  | { kind: 'renameSection'; id: string; name: string }
  | { kind: 'deleteSection'; id: string }
  | { kind: 'reorderSections'; ids: string[] }
  | { kind: 'createItem'; input: NewVaultItemInput & { id: string } }
  | { kind: 'updateItem'; id: string; patch: VaultItemPatch }
  | { kind: 'deleteItem'; id: string }
  | { kind: 'reorderItems'; sectionId: string; ids: string[] };

export interface VaultState {
  sections: VaultSection[];
  items: VaultItem[];
  createSection(name: string): Promise<boolean>;
  renameSection(id: string, name: string): Promise<boolean>;
  deleteSection(id: string): Promise<boolean>;
  moveSection(id: string, delta: -1 | 1): Promise<boolean>;
  createItem(input: NewVaultItemInput): Promise<boolean>;
  updateItem(id: string, patch: VaultItemPatch): Promise<boolean>;
  deleteItem(id: string): Promise<boolean>;
  moveItem(id: string, delta: -1 | 1): Promise<boolean>;
  /** Drag-and-drop: place `activeId` where `overId` is (same section and type). */
  dropItem(activeId: string, overId: string): Promise<boolean>;
}

const newId = () => crypto.randomUUID();
const byOrder = <T extends { order: number }>(list: T[]) => [...list].sort((a, b) => a.order - b.order);

function moved(ids: string[], id: string, delta: -1 | 1): string[] | null {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function pick<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

/** Applies field updates to the listed ids only. */
function patchById<T extends { id: string }>(list: T[], fields: Map<string, Partial<T>>): T[] {
  return list.map((x) => (fields.has(x.id) ? { ...x, ...fields.get(x.id) } : x));
}

/** Re-inserts entities that are missing (rollback of a delete). */
function reinsert<T extends { id: string }>(list: T[], missing: T[]): T[] {
  return [...list, ...missing.filter((m) => !list.some((x) => x.id === m.id))];
}

export function useVaultState(initial: { sections: VaultSection[]; items: VaultItem[] }): VaultState {
  const [sections, setSections] = useState(initial.sections);
  const [items, setItems] = useState(initial.items);
  const snapshot = useRef({ sections: initial.sections, items: initial.items });
  const execRef = useRef<(op: Op) => Promise<boolean>>(async () => false);

  useEffect(() => {
    snapshot.current = { sections, items };
  }, [sections, items]);

  const fail = (error: string, op: Op) => {
    toast.error('Не удалось сохранить', {
      description: error,
      duration: 10000,
      action: { label: 'Повторить', onClick: () => void execRef.current(op) },
    });
    return false;
  };

  const orders = <T extends { id: string; order: number }>(list: T[], ids: string[]) =>
    new Map(list.filter((x) => ids.includes(x.id)).map((x) => [x.id, { order: x.order } as Partial<T>]));

  async function exec(op: Op): Promise<boolean> {
    const before = snapshot.current;
    switch (op.kind) {
      case 'createSection': {
        const order = before.sections.reduce((m, s) => Math.max(m, s.order + 1), 0);
        setSections((prev) => [...prev.filter((s) => s.id !== op.id), { id: op.id, name: op.name, order }]);
        const res = await safeAction(() => createSectionAction(op.name, op.id));
        if (res.ok) {
          setSections((prev) => prev.map((s) => (s.id === op.id ? res.data : s)));
          return true;
        }
        setSections((prev) => prev.filter((s) => s.id !== op.id));
        return fail(res.error, op);
      }
      case 'renameSection': {
        const prevSection = before.sections.find((s) => s.id === op.id);
        if (!prevSection) return false;
        setSections((prev) => patchById(prev, new Map([[op.id, { name: op.name }]])));
        const res = await safeAction(() => renameSectionAction(op.id, op.name));
        if (res.ok) return true;
        setSections((prev) => patchById(prev, new Map([[op.id, { name: prevSection.name }]])));
        return fail(res.error, op);
      }
      case 'deleteSection': {
        const prevSection = before.sections.find((s) => s.id === op.id);
        if (!prevSection) return false;
        const prevItems = before.items.filter((i) => i.sectionId === op.id);
        setSections((prev) => prev.filter((s) => s.id !== op.id));
        setItems((prev) => prev.filter((i) => i.sectionId !== op.id));
        const res = await safeAction(() => deleteSectionAction(op.id));
        if (res.ok) return true;
        setSections((prev) => reinsert(prev, [prevSection]));
        setItems((prev) => reinsert(prev, prevItems));
        return fail(res.error, op);
      }
      case 'reorderSections': {
        const prevOrders = orders(before.sections, op.ids);
        setSections((prev) => patchById(prev, new Map(op.ids.map((id, order) => [id, { order }]))));
        const res = await safeAction(() => reorderSectionsAction(op.ids));
        if (res.ok) return true;
        setSections((prev) => patchById(prev, prevOrders));
        return fail(res.error, op);
      }
      case 'createItem': {
        const { input } = op;
        const order = before.items
          .filter((i) => i.sectionId === input.sectionId)
          .reduce((m, i) => Math.max(m, i.order + 1), 0);
        setItems((prev) => [...prev.filter((i) => i.id !== input.id), { ...input, order }]);
        const res = await safeAction(() => createItemAction(input));
        if (res.ok) {
          setItems((prev) => prev.map((i) => (i.id === input.id ? res.data : i)));
          return true;
        }
        setItems((prev) => prev.filter((i) => i.id !== input.id));
        return fail(res.error, op);
      }
      case 'updateItem': {
        const prevItem = before.items.find((i) => i.id === op.id);
        if (!prevItem) return false;
        const keys = Object.keys(op.patch) as (keyof VaultItem)[];
        setItems((prev) => patchById<VaultItem>(prev, new Map([[op.id, op.patch as Partial<VaultItem>]])));
        const res = await safeAction(() => updateItemAction(op.id, op.patch));
        if (res.ok) {
          setItems((prev) => patchById(prev, new Map([[op.id, pick(res.data, keys)]])));
          return true;
        }
        setItems((prev) => patchById(prev, new Map([[op.id, pick(prevItem, keys)]])));
        return fail(res.error, op);
      }
      case 'deleteItem': {
        const prevItem = before.items.find((i) => i.id === op.id);
        if (!prevItem) return false;
        setItems((prev) => prev.filter((i) => i.id !== op.id));
        const res = await safeAction(() => deleteItemAction(op.id));
        if (res.ok) return true;
        setItems((prev) => reinsert(prev, [prevItem]));
        return fail(res.error, op);
      }
      case 'reorderItems': {
        const prevOrders = orders(before.items, op.ids);
        setItems((prev) => patchById(prev, new Map(op.ids.map((id, order) => [id, { order }]))));
        const res = await safeAction(() => reorderItemsAction(op.sectionId, op.ids));
        if (res.ok) return true;
        setItems((prev) => patchById(prev, prevOrders));
        return fail(res.error, op);
      }
    }
  }

  useEffect(() => {
    execRef.current = exec;
  });

  const sortedSections = useMemo(() => byOrder(sections), [sections]);
  const sortedItems = useMemo(() => byOrder(items), [items]);

  return {
    sections: sortedSections,
    items: sortedItems,
    createSection: (name) => exec({ kind: 'createSection', id: newId(), name }),
    renameSection: (id, name) => exec({ kind: 'renameSection', id, name }),
    deleteSection: (id) => exec({ kind: 'deleteSection', id }),
    moveSection: async (id, delta) => {
      const ids = moved(byOrder(snapshot.current.sections).map((s) => s.id), id, delta);
      return ids ? exec({ kind: 'reorderSections', ids }) : false;
    },
    createItem: (input) => exec({ kind: 'createItem', input: { ...input, id: input.id ?? newId() } }),
    updateItem: (id, patch) => exec({ kind: 'updateItem', id, patch }),
    deleteItem: (id) => exec({ kind: 'deleteItem', id }),
    moveItem: async (id, delta) => {
      const item = snapshot.current.items.find((i) => i.id === id);
      const ids = sectionOrderAfterMove(snapshot.current.items, id, delta);
      return item && ids ? exec({ kind: 'reorderItems', sectionId: item.sectionId, ids }) : false;
    },
    dropItem: async (activeId, overId) => {
      const item = snapshot.current.items.find((i) => i.id === activeId);
      const ids = sectionOrderAfterDrop(snapshot.current.items, activeId, overId);
      return item && ids ? exec({ kind: 'reorderItems', sectionId: item.sectionId, ids }) : false;
    },
  };
}
