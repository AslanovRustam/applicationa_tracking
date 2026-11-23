'use client';

import { ArrowDownIcon, ArrowUpIcon, ExternalLinkIcon } from 'lucide-react';
import type { SortKey } from '@/lib/domain/filter';
import { SOURCE_LABELS } from '@/lib/domain/source';
import { isStale } from '@/lib/domain/status';
import { formatShortDate } from '@/lib/domain/time';
import type { Application } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { StaleMark, StatusBadge } from './StatusBadge';

export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: SortState;
  onSort: (s: SortState) => void;
}) {
  const active = sort.key === k;
  const Icon = sort.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => onSort({ key: k, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}
    >
      {label}
      {active && <Icon className="size-3" />}
    </button>
  );
}

export function ApplicationsTable({
  apps,
  today,
  sort,
  onSort,
  onOpen,
  selectedId,
}: {
  apps: Application[];
  today: string;
  sort: SortState;
  onSort: (s: SortState) => void;
  onOpen: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
          <tr>
            <th className="w-20 px-3 py-2">
              <SortHeader label="Дата" k="appliedAt" sort={sort} onSort={onSort} />
            </th>
            <th className="px-3 py-2">
              <SortHeader label="Компания" k="company" sort={sort} onSort={onSort} />
            </th>
            <th className="px-3 py-2">Должность</th>
            <th className="px-3 py-2">
              <SortHeader label="Статус" k="status" sort={sort} onSort={onSort} />
            </th>
            <th className="px-3 py-2">Источник</th>
            <th className="px-3 py-2">ЗП</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr
              key={a.id}
              onClick={() => onOpen(a.id)}
              className={cn(
                'cursor-pointer border-t transition-colors hover:bg-muted/40',
                selectedId === a.id && 'bg-blue-50 hover:bg-blue-50 dark:bg-blue-950/40',
                a.id.startsWith('tmp-') && 'opacity-60',
              )}
            >
              <td className="px-3 py-2 tabular-nums text-muted-foreground">{formatShortDate(a.appliedAt)}</td>
              <td className="max-w-48 truncate px-3 py-2 font-medium">{a.company}</td>
              <td className="max-w-72 truncate px-3 py-2">{a.position}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <StatusBadge app={a} />
                  {isStale(a, today) && <StaleMark />}
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                  >
                    {SOURCE_LABELS[a.source]} <ExternalLinkIcon className="size-3" />
                  </a>
                ) : (
                  SOURCE_LABELS[a.source]
                )}
              </td>
              <td className="max-w-32 truncate px-3 py-2 tabular-nums text-muted-foreground">{a.salaryAsked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
