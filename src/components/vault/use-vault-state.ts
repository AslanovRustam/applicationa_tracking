'use client';

import { useEffect, useRef, useState } from 'react';
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
import type { NewVaultItemInput, VaultItemPatch } from '@/lib/repo/inputs';

type Op =
  | { kind: 'createSection'; name: string }
  | { kind: 'renameSection'; id: string; name: string }
  | { kind: 'deleteSection'; id: string }
  | { kind: 'reorderSections'; ids: string[] }
  | { kind: 'createItem'; input: NewVaultItemInput }
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
}

let tmpCounter = 0;
const tmpId = () => `tmp-${Date.now()}-${++tmpCounter}`;
const byOrder = <T extends { order: number }>(list: T[]) => [...list].sort((a, b) => a.order - b.order);

function moved(ids: string[], id: string, delta: -1 | 1): string[] | null {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function useVaultState(initial: { sections: VaultSection[]; items: VaultItem[] }): VaultState {
  const [sections, setSections] = useState(() => byOrder(initial.sections));
  const [items, setItems] = useState(() => byOrder(initial.items));
  const snapshot = useRef({ sections, items });
  const execRef = useRef<(op: Op) => Promise<boolean>>(async () => false);

  useEffect(() => {
    snapshot.current = { sections, items };
  }, [sections, items]);

  const restore = (before: { sections: VaultSection[]; items: VaultItem[] }) => {
    setSections(before.sections);
    setItems(before.items);
  };

  const fail = (error: string, op: Op) => {
    toast.error('Не удалось сохранить', {
      description: error,
      duration: 10000,
      action: { label: 'Повторить', onClick: () => void execRef.current(op) },
    });
    return false;
  };

  async function exec(op: Op): Promise<boolean> {
    const before = snapshot.current;
    switch (op.kind) {
      case 'createSection': {
        const id = tmpId();
        const order = before.sections.reduce((m, s) => Math.max(m, s.order + 1), 0);
        setSections((prev) => [...prev, { id, name: op.name, order }]);
        const res = await createSectionAction(op.name);
        if (res.ok) {
          setSections((prev) => prev.map((s) => (s.id === id ? res.data : s)));
          return true;
        }
        setSections((prev) => prev.filter((s) => s.id !== id));
        return fail(res.error, op);
      }
      case 'renameSection': {
        setSections((prev) => prev.map((s) => (s.id === op.id ? { ...s, name: op.name } : s)));
        const res = await renameSectionAction(op.id, op.name);
        if (res.ok) return true;
        restore(before);
        return fail(res.error, op);
      }
      case 'deleteSection': {
        setSections((prev) => prev.filter((s) => s.id !== op.id));
        setItems((prev) => prev.filter((i) => i.sectionId !== op.id));
        const res = await deleteSectionAction(op.id);
        if (res.ok) return true;
        restore(before);
        return fail(res.error, op);
      }
      case 'reorderSections': {
        setSections((prev) => byOrder(prev.map((s) => ({ ...s, order: op.ids.indexOf(s.id) }))));
        const res = await reorderSectionsAction(op.ids);
        if (res.ok) return true;
        restore(before);
        return fail(res.error, op);
      }
      case 'createItem': {
        const id = tmpId();
        const order = before.items
          .filter((i) => i.sectionId === op.input.sectionId)
          .reduce((m, i) => Math.max(m, i.order + 1), 0);
        setItems((prev) => [...prev, { id, ...op.input, order }]);
        const res = await createItemAction(op.input);
        if (res.ok) {
          setItems((prev) => prev.map((i) => (i.id === id ? res.data : i)));
          return true;
        }
        setItems((prev) => prev.filter((i) => i.id !== id));
        return fail(res.error, op);
      }
      case 'updateItem': {
        setItems((prev) => prev.map((i) => (i.id === op.id ? { ...i, ...op.patch } : i)));
        const res = await updateItemAction(op.id, op.patch);
        if (res.ok) {
          setItems((prev) => prev.map((i) => (i.id === op.id ? res.data : i)));
          return true;
        }
        restore(before);
        return fail(res.error, op);
      }
      case 'deleteItem': {
        setItems((prev) => prev.filter((i) => i.id !== op.id));
        const res = await deleteItemAction(op.id);
        if (res.ok) return true;
        restore(before);
        return fail(res.error, op);
      }
      case 'reorderItems': {
        setItems((prev) =>
          byOrder(prev.map((i) => (i.sectionId === op.sectionId ? { ...i, order: op.ids.indexOf(i.id) } : i))),
        );
        const res = await reorderItemsAction(op.sectionId, op.ids);
        if (res.ok) return true;
        restore(before);
        return fail(res.error, op);
      }
    }
  }

  useEffect(() => {
    execRef.current = exec;
  });

  return {
    sections,
    items,
    createSection: (name) => exec({ kind: 'createSection', name }),
    renameSection: (id, name) => exec({ kind: 'renameSection', id, name }),
    deleteSection: (id) => exec({ kind: 'deleteSection', id }),
    moveSection: async (id, delta) => {
      const ids = moved(byOrder(snapshot.current.sections).map((s) => s.id), id, delta);
      return ids ? exec({ kind: 'reorderSections', ids }) : false;
    },
    createItem: (input) => exec({ kind: 'createItem', input }),
    updateItem: (id, patch) => exec({ kind: 'updateItem', id, patch }),
    deleteItem: (id) => exec({ kind: 'deleteItem', id }),
    moveItem: async (id, delta) => {
      const item = snapshot.current.items.find((i) => i.id === id);
      if (!item) return false;
      const siblings = byOrder(snapshot.current.items.filter((i) => i.sectionId === item.sectionId)).map((i) => i.id);
      const ids = moved(siblings, id, delta);
      return ids ? exec({ kind: 'reorderItems', sectionId: item.sectionId, ids }) : false;
    },
  };
}
