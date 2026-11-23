'use client';

import { CopyIcon, ExternalLinkIcon } from 'lucide-react';
import type { VaultItem } from '@/lib/domain/types';
import { ItemMenu } from './ItemMenu';

export function LinkChip({
  item,
  onCopy,
  onEdit,
  onUp,
  onDown,
  onDelete,
}: {
  item: VaultItem;
  onCopy: () => void;
  onEdit: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-card pl-1 shadow-xs">
      <button
        type="button"
        onClick={onCopy}
        title={`Скопировать: ${item.content}`}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
      >
        {item.title}
        <CopyIcon className="size-3.5 text-blue-600 dark:text-blue-400" />
      </button>
      <a
        href={item.content}
        target="_blank"
        rel="noreferrer"
        aria-label={`Открыть ${item.title}`}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ExternalLinkIcon className="size-3.5" />
      </a>
      <ItemMenu label={item.title} onEdit={onEdit} onUp={onUp} onDown={onDown} onDelete={onDelete} />
    </div>
  );
}
