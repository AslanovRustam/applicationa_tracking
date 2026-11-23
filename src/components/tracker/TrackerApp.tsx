'use client';

import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { filterApplications, groupCounts, sortApplications, type Filters } from '@/lib/domain/filter';
import { ACTIVE_STATUSES, isStale } from '@/lib/domain/status';
import { computeSummary } from '@/lib/domain/summary';
import { todayInKyiv } from '@/lib/domain/time';
import type { VaultItem } from '@/lib/domain/types';
import type { AllData } from '@/lib/repo/repo';
import { ApplicationDrawer } from './ApplicationDrawer';
import { Board } from './Board';
import { ApplicationForm } from './ApplicationForm';
import { ApplicationsList } from './ApplicationsList';
import { ApplicationsTable, type SortState } from './ApplicationsTable';
import { StaleBanner } from './StaleBanner';
import { SummaryCards } from './SummaryCards';
import { Toolbar, type TrackerView } from './Toolbar';
import { useTrackerState } from './use-tracker-state';

export function TrackerApp({
  initial,
  vaultItems,
}: {
  initial: Pick<AllData, 'applications' | 'history'>;
  vaultItems: VaultItem[];
}) {
  const state = useTrackerState(initial);
  const [filters, setFilters] = useState<Filters>({ query: '', group: 'all', source: 'all' });
  const [sort, setSort] = useState<SortState>({ key: 'appliedAt', dir: 'desc' });
  const [view, setView] = useState<TrackerView>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const now = new Date();
  const today = todayInKyiv(now);
  const summary = computeSummary(state.applications, now);
  const counts = useMemo(() => groupCounts(state.applications), [state.applications]);
  const visible = useMemo(
    () => sortApplications(filterApplications(state.applications, filters), sort.key, sort.dir),
    [state.applications, filters, sort],
  );
  const boardApps = useMemo(
    () =>
      filterApplications(state.applications, { ...filters, group: 'all' }).filter((a) =>
        ACTIVE_STATUSES.includes(a.status),
      ),
    [state.applications, filters],
  );
  const staleIds = useMemo(
    () => state.applications.filter((a) => isStale(a, today)).map((a) => a.id),
    [state.applications, today],
  );
  const selected = state.applications.find((a) => a.id === selectedId) ?? null;
  const selectedHistory = useMemo(
    () => state.history.filter((h) => h.applicationId === selectedId),
    [state.history, selectedId],
  );
  void vaultItems; // used by the drawer's cover-letter picker (Task 11)

  return (
    <div className="space-y-4">
      <SummaryCards summary={summary} onOpenEvent={setSelectedId} />
      <StaleBanner staleIds={staleIds} onMarkAll={(ids) => void state.markGhosted(ids)} />
      <Toolbar
        filters={filters}
        onFiltersChange={setFilters}
        counts={counts}
        view={view}
        onViewChange={setView}
        onAdd={() => setFormOpen(true)}
      />

      {view === 'table' ? (
        visible.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            {state.applications.length === 0 ? 'Пока нет откликов — добавьте первый.' : 'Ничего не найдено.'}
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <ApplicationsTable
                apps={visible}
                today={today}
                sort={sort}
                onSort={setSort}
                onOpen={setSelectedId}
                selectedId={selectedId}
              />
            </div>
            <div className="md:hidden">
              <ApplicationsList apps={visible} today={today} onOpen={setSelectedId} />
            </div>
          </>
        )
      ) : (
        <Board
          apps={boardApps}
          history={state.history}
          onOpen={setSelectedId}
          onChangeStatus={(id, change) => void state.changeStatus(id, change)}
        />
      )}

      <button
        type="button"
        onClick={() => setFormOpen(true)}
        aria-label="Добавить отклик"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 md:hidden"
      >
        <PlusIcon className="size-6" />
      </button>

      <ApplicationDrawer
        app={selected}
        appHistory={selectedHistory}
        state={state}
        onClose={() => setSelectedId(null)}
      />
      <ApplicationForm open={formOpen} onOpenChange={setFormOpen} onSubmit={state.create} />
    </div>
  );
}
