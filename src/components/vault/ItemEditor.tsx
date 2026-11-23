'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VaultItem, VaultItemType } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

export interface ItemDraft {
  type: VaultItemType;
  title: string;
  content: string;
  tags: string[];
}

export function ItemEditor({
  item,
  onClose,
  onSave,
}: {
  /** `null` = closed; `{}` without id = new item */
  item: Partial<VaultItem> | null;
  onClose: () => void;
  onSave: (draft: ItemDraft) => void;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {item && <EditorForm key={item.id ?? 'new'} item={item} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function EditorForm({ item, onSave }: { item: Partial<VaultItem>; onSave: (draft: ItemDraft) => void }) {
  const [type, setType] = useState<VaultItemType>(item.type ?? 'text');
  const [title, setTitle] = useState(item.title ?? '');
  const [content, setContent] = useState(item.content ?? '');
  const [tags, setTags] = useState((item.tags ?? []).join(', '));
  const [error, setError] = useState('');

  return (
    <>
      <DialogHeader>
        <DialogTitle>{item.id ? 'Изменить запись' : 'Новая запись'}</DialogTitle>
      </DialogHeader>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return setError('Укажите название');
          if (!content.trim()) return setError(type === 'link' ? 'Укажите ссылку' : 'Введите текст');
          onSave({
            type,
            title: title.trim(),
            content: type === 'link' ? content.trim() : content,
            tags: tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          });
        }}
      >
        <div className="inline-flex w-fit rounded-lg border p-0.5" role="radiogroup" aria-label="Тип">
          {(
            [
              ['text', 'Текст'],
              ['link', 'Ссылка'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={type === v}
              onClick={() => setType(v)}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium',
                type === v ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ie-title">Название</Label>
          <Input
            id="ie-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'link' ? 'GitHub' : 'Сопроводительное — короткое'}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ie-content">{type === 'link' ? 'Ссылка' : 'Текст'}</Label>
          {type === 'link' ? (
            <Input id="ie-content" inputMode="url" value={content} onChange={(e) => setContent(e.target.value)} placeholder="https://…" />
          ) : (
            <>
              <Textarea id="ie-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Переменные: {'{компания}'} {'{должность}'} {'{ссылка}'} {'{контакт}'} или любая своя, например {'{имя}'}
              </p>
            </>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ie-tags">Теги через запятую</Label>
          <Input id="ie-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="EN, cover" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="justify-self-end">
          Сохранить
        </Button>
      </form>
    </>
  );
}
