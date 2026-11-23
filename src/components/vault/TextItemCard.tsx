'use client';

import { CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { extractVariables, fillTemplate } from '@/lib/domain/template';
import type { Application, VaultItem } from '@/lib/domain/types';
import { ItemMenu } from './ItemMenu';

/** Renders text with {variables} highlighted. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\{[^{}\s]+\})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\{[^{}\s]+\}$/.test(p) ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function TextItemCard({
  item,
  applications,
  defaultApplicationId,
  onCopy,
  onEdit,
  onUp,
  onDown,
  onDelete,
}: {
  item: VaultItem;
  applications: Application[];
  defaultApplicationId: string | null;
  onCopy: (text: string, app: Application | null) => void;
  onEdit: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const hasVars = extractVariables(item.content).length > 0;
  // null = follow the default (the latest application); '' = explicitly "no application"
  const [chosenId, setChosenId] = useState<string | null>(null);
  const appId = chosenId ?? defaultApplicationId ?? '';
  const app = applications.find((a) => a.id === appId) ?? null;
  const preview = hasVars ? fillTemplate(item.content, app, {}).text : item.content;

  return (
    <article className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate font-medium">{item.title}</h4>
          {item.tags.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {item.tags.map((t) => (
                <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ItemMenu label={item.title} onEdit={onEdit} onUp={onUp} onDown={onDown} onDelete={onDelete} />
      </header>
      <p className="line-clamp-3 text-sm whitespace-pre-line text-muted-foreground">
        <Highlighted text={preview} />
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {hasVars && (
          <NativeSelect
            value={appId}
            onChange={(e) => setChosenId(e.target.value)}
            aria-label="Для какого отклика"
            className="min-w-0 flex-1"
          >
            <option value="">— без отклика —</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company} · {a.position}
              </option>
            ))}
          </NativeSelect>
        )}
        <Button size="sm" onClick={() => onCopy(item.content, app)}>
          <CopyIcon /> Копировать
        </Button>
      </div>
    </article>
  );
}
