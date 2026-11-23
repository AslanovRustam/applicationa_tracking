import type { VaultItem } from './types';

const byOrder = (a: VaultItem, b: VaultItem) => a.order - b.order;

/** Items of one section as displayed: links first, then texts, each in their own order. */
function grouped(items: VaultItem[], sectionId: string) {
  const inSection = items.filter((i) => i.sectionId === sectionId).sort(byOrder);
  return {
    link: inSection.filter((i) => i.type === 'link').map((i) => i.id),
    text: inSection.filter((i) => i.type === 'text').map((i) => i.id),
  };
}

/** Moves an item one step among items of the same type; returns the section's full new order or null. */
export function sectionOrderAfterMove(items: VaultItem[], id: string, delta: -1 | 1): string[] | null {
  const it = items.find((i) => i.id === id);
  if (!it) return null;
  const g = grouped(items, it.sectionId);
  const list = g[it.type];
  const i = list.indexOf(id);
  const j = i + delta;
  if (j < 0 || j >= list.length) return null;
  [list[i], list[j]] = [list[j], list[i]];
  return [...g.link, ...g.text];
}

/** Drag-and-drop: puts `activeId` at `overId`'s place (same section and type only). */
export function sectionOrderAfterDrop(items: VaultItem[], activeId: string, overId: string): string[] | null {
  if (activeId === overId) return null;
  const active = items.find((i) => i.id === activeId);
  const over = items.find((i) => i.id === overId);
  if (!active || !over || active.sectionId !== over.sectionId || active.type !== over.type) return null;
  const g = grouped(items, active.sectionId);
  const list = g[active.type];
  const from = list.indexOf(activeId);
  const to = list.indexOf(overId);
  list.splice(from, 1);
  list.splice(to, 0, activeId);
  return [...g.link, ...g.text];
}
