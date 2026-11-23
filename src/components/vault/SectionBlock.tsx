'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { PlusIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Application, VaultItem, VaultSection } from '@/lib/domain/types';
import { ItemMenu } from './ItemMenu';
import { LinkChip } from './LinkChip';
import { SortableItem } from './SortableItem';
import { TextItemCard } from './TextItemCard';

export interface SectionHandlers {
  onRename: (name: string) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: VaultItem) => void;
  onMoveItem: (item: VaultItem, delta: -1 | 1) => void;
  onDropItem: (activeId: string, overId: string) => void;
  onDeleteItem: (item: VaultItem) => void;
  onCopyLink: (item: VaultItem) => void;
  onCopyText: (text: string, app: Application | null) => void;
}

export function SectionBlock({
  section,
  items,
  applications,
  defaultApplicationId,
  handlers: h,
}: {
  section: VaultSection;
  items: VaultItem[];
  applications: Application[];
  defaultApplicationId: string | null;
  handlers: SectionHandlers;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(section.name);
  // Stable ids keep dnd-kit's accessibility attributes identical on server and client.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) h.onDropItem(String(e.active.id), String(e.over.id));
  };
  const links = items.filter((i) => i.type === 'link');
  const texts = items.filter((i) => i.type === 'text');

  const finishRename = () => {
    setRenaming(false);
    const next = name.trim();
    if (next && next !== section.name) h.onRename(next);
    else setName(section.name);
  };

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2 border-b pb-2">
        {renaming ? (
          <Input
            autoFocus
            aria-label="Название раздела"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishRename();
              if (e.key === 'Escape') {
                setName(section.name);
                setRenaming(false);
              }
            }}
            className="h-8 max-w-xs text-base font-semibold"
          />
        ) : (
          <h2
            className="cursor-text text-base font-semibold"
            onDoubleClick={() => {
              setName(section.name);
              setRenaming(true);
            }}
          >
            {section.name}
          </h2>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={h.onAddItem}>
            <PlusIcon /> Запись
          </Button>
          <ItemMenu
            label={section.name}
            editLabel="Переименовать"
            onEdit={() => {
              setName(section.name);
              setRenaming(true);
            }}
            onUp={() => h.onMove(-1)}
            onDown={() => h.onMove(1)}
            onDelete={h.onDelete}
          />
        </div>
      </header>

      {items.length === 0 && <p className="text-sm text-muted-foreground">Пусто — добавьте ссылку или текст.</p>}

      {links.length > 0 && (
        <DndContext id={`${dndId}-links`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={links.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-2">
              {links.map((item) => (
                <SortableItem key={item.id} id={item.id} label={item.title}>
                  {(handle) => (
                    <LinkChip
                      item={item}
                      handle={handle}
                      onCopy={() => h.onCopyLink(item)}
                      onEdit={() => h.onEditItem(item)}
                      onUp={() => h.onMoveItem(item, -1)}
                      onDown={() => h.onMoveItem(item, 1)}
                      onDelete={() => h.onDeleteItem(item)}
                    />
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {texts.length > 0 && (
        <DndContext id={`${dndId}-texts`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={texts.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-3 md:grid-cols-2">
              {texts.map((item) => (
                <SortableItem key={item.id} id={item.id} label={item.title}>
                  {(handle) => (
                    <TextItemCard
                      item={item}
                      handle={handle}
                      applications={applications}
                      defaultApplicationId={defaultApplicationId}
                      onCopy={h.onCopyText}
                      onEdit={() => h.onEditItem(item)}
                      onUp={() => h.onMoveItem(item, -1)}
                      onDown={() => h.onMoveItem(item, 1)}
                      onDelete={() => h.onDeleteItem(item)}
                    />
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
