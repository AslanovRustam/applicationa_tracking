'use client';

import { SOURCE_LABELS } from '@/lib/domain/source';
import { isStale } from '@/lib/domain/status';
import { formatShortDate } from '@/lib/domain/time';
import type { Application } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { StaleMark, StatusBadge } from './StatusBadge';

export function ApplicationsList({
  apps,
  today,
  onOpen,
}: {
  apps: Application[];
  today: string;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {apps.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onOpen(a.id)}
            className={cn(
              'w-full rounded-xl border bg-card px-3 py-2.5 text-left active:bg-muted/50',
              a.id.startsWith('tmp-') && 'opacity-60',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{a.company}</div>
                <div className="truncate text-sm text-muted-foreground">{a.position}</div>
              </div>
              <StatusBadge app={a} className="mt-0.5 shrink-0" />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{formatShortDate(a.appliedAt)}</span>
              <span>·</span>
              <span>{SOURCE_LABELS[a.source]}</span>
              {isStale(a, today) && <StaleMark />}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
