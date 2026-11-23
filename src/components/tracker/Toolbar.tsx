'use client';

import { KanbanSquareIcon, PlusIcon, SearchIcon, TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { STATUS_GROUP_LABELS, type Filters, type StatusGroup } from '@/lib/domain/filter';
import { SOURCE_LABELS } from '@/lib/domain/source';
import { SOURCES, type Source } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

export type TrackerView = 'table' | 'board';

const GROUPS: StatusGroup[] = ['all', 'waiting', 'active', 'rejected', 'ghosted'];

export function Toolbar({
  filters,
  onFiltersChange,
  counts,
  view,
  onViewChange,
  onAdd,
}: {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  counts: Record<StatusGroup, number>;
  view: TrackerView;
  onViewChange: (v: TrackerView) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onAdd} className="hidden md:inline-flex">
          <PlusIcon /> Отклик
        </Button>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
            placeholder="Компания или должность…"
            className="pl-8"
            aria-label="Поиск"
          />
        </div>
        <NativeSelect
          value={filters.source}
          onChange={(e) => onFiltersChange({ ...filters, source: e.target.value as Source | 'all' })}
          aria-label="Источник"
          className="max-w-[10rem]"
        >
          <option value="all">Все источники</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto inline-flex rounded-lg border p-0.5" role="tablist" aria-label="Вид">
          {(
            [
              ['table', 'Таблица', TableIcon],
              ['board', 'Доска', KanbanSquareIcon],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => onViewChange(v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium',
                view === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
      {view === 'table' && (
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onFiltersChange({ ...filters, group: g })}
              aria-pressed={filters.group === g}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm',
                filters.group === g
                  ? 'border-foreground bg-foreground text-background'
                  : 'bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {STATUS_GROUP_LABELS[g]} <span className="tabular-nums opacity-70">{counts[g]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
