'use client';

import { FolderPlusIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/tracker/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Application, VaultItem, VaultSection } from '@/lib/domain/types';
import { plural } from '@/lib/plural';
import { cn } from '@/lib/utils';
import { ItemEditor } from './ItemEditor';
import { SectionBlock } from './SectionBlock';
import { useCopyTemplate } from './use-copy-template';
import { useVaultState } from './use-vault-state';

type Confirm = { kind: 'section'; section: VaultSection; count: number } | { kind: 'item'; item: VaultItem } | null;

export function VaultApp({
  initial,
  applications,
}: {
  initial: { sections: VaultSection[]; items: VaultItem[] };
  applications: Application[];
}) {
  const vault = useVaultState(initial);
  const { copyTemplate, copyPlain, dialog } = useCopyTemplate();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<VaultItem> | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [newSection, setNewSection] = useState<string | null>(null);

  const sortedApps = useMemo(
    () => [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [applications],
  );
  const defaultApplicationId = sortedApps[0]?.id ?? null;
  const allTags = useMemo(() => [...new Set(vault.items.flatMap((i) => i.tags))].sort(), [vault.items]);

  const q = query.trim().toLowerCase();
  const filtering = Boolean(q || tag);
  const matches = (i: VaultItem) =>
    (!q || i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)) && (!tag || i.tags.includes(tag));

  const saveNewSection = () => {
    const name = newSection?.trim();
    setNewSection(null);
    if (name) void vault.createSection(name);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию и тексту…"
            className="pl-8"
            aria-label="Поиск"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs',
                  tag === t ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {vault.sections.map((section) => {
        const sectionItems = vault.items.filter((i) => i.sectionId === section.id);
        const visible = filtering ? sectionItems.filter(matches) : sectionItems;
        if (filtering && visible.length === 0) return null;
        return (
          <SectionBlock
            key={section.id}
            section={section}
            items={visible}
            applications={sortedApps}
            defaultApplicationId={defaultApplicationId}
            handlers={{
              onRename: (name) => void vault.renameSection(section.id, name),
              onMove: (d) => void vault.moveSection(section.id, d),
              onDelete: () => setConfirm({ kind: 'section', section, count: sectionItems.length }),
              onAddItem: () => setEditing({ sectionId: section.id }),
              onEditItem: (item) => setEditing(item),
              onMoveItem: (item, d) => void vault.moveItem(item.id, d),
              onDropItem: (activeId, overId) => void vault.dropItem(activeId, overId),
              onDeleteItem: (item) => setConfirm({ kind: 'item', item }),
              onCopyLink: (item) => void copyPlain(item.content),
              onCopyText: copyTemplate,
            }}
          />
        );
      })}

      {filtering && !vault.items.some(matches) && <p className="text-sm text-muted-foreground">Ничего не найдено.</p>}

      {newSection === null ? (
        <Button variant="outline" onClick={() => setNewSection('')}>
          <FolderPlusIcon /> Новый раздел
        </Button>
      ) : (
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveNewSection();
          }}
        >
          <Input
            autoFocus
            aria-label="Название нового раздела"
            placeholder="Например: Ответы на частые вопросы"
            value={newSection}
            onChange={(e) => setNewSection(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNewSection(null)}
          />
          <Button type="submit">Создать</Button>
        </form>
      )}

      <ItemEditor
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(draft) => {
          if (!editing) return;
          if (editing.id) void vault.updateItem(editing.id, draft);
          else if (editing.sectionId) void vault.createItem({ sectionId: editing.sectionId, ...draft });
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === 'section'
            ? `Удалить раздел «${confirm.section.name}»${confirm.count ? ` и ${confirm.count} ${plural(confirm.count, ['запись', 'записи', 'записей'])}` : ''}?`
            : `Удалить «${confirm?.kind === 'item' ? confirm.item.title : ''}»?`
        }
        description="Это нельзя отменить."
        confirmLabel="Удалить"
        destructive
        onConfirm={() => {
          if (confirm?.kind === 'section') void vault.deleteSection(confirm.section.id);
          if (confirm?.kind === 'item') void vault.deleteItem(confirm.item.id);
          setConfirm(null);
        }}
      />
      {dialog}
    </div>
  );
}
