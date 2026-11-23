'use client';

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { XCircleIcon } from 'lucide-react';
import { useId } from 'react';
import { BOARD_COLUMNS, boardChangeFor, type BoardColumn } from '@/lib/domain/board';
import { SOURCE_LABELS } from '@/lib/domain/source';
import { STATUS_LABELS } from '@/lib/domain/status';
import { formatShortDateTime } from '@/lib/domain/time';
import type { Application, HistoryEntry, StatusChange } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';

function Card({ app, onOpen }: { app: Application; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(app.id)}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        'w-full touch-manipulation rounded-lg border bg-card p-2.5 text-left shadow-xs',
        isDragging && 'relative z-50 rotate-1 shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-medium">{app.company}</span>
        {app.status === 'interview' && <StatusBadge app={app} className="shrink-0" />}
      </div>
      <div className="truncate text-xs text-muted-foreground">{app.position}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {SOURCE_LABELS[app.source]}
        {app.nextEventAt && <span className="ml-1 text-blue-600 dark:text-blue-400">· {formatShortDateTime(app.nextEventAt)}</span>}
      </div>
    </button>
  );
}

function Column({
  column,
  apps,
  onOpen,
}: {
  column: BoardColumn;
  apps: Application[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/60 p-2 md:w-auto md:min-w-0 md:flex-1',
        isOver && 'ring-2 ring-blue-400',
      )}
    >
      <h3 className="flex items-center justify-between px-1 text-xs font-semibold text-muted-foreground">
        {STATUS_LABELS[column]} <span className="tabular-nums">{apps.length}</span>
      </h3>
      {apps.map((a) => (
        <Card key={a.id} app={a} onOpen={onOpen} />
      ))}
      {apps.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Перетащите сюда</p>}
    </section>
  );
}

function RejectZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'rejected' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 text-sm text-muted-foreground',
        isOver && 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
      )}
    >
      <XCircleIcon className="size-4" /> Перетащите сюда, чтобы отметить отказ
    </div>
  );
}

/** Archive: most recently archived first; other columns keep the given order. */
function columnApps(apps: Application[], column: BoardColumn): Application[] {
  const list = apps.filter((a) => a.status === column);
  return column === 'archived' ? [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : list;
}

export function Board({
  apps,
  history,
  onOpen,
  onChangeStatus,
}: {
  apps: Application[];
  history: HistoryEntry[];
  onOpen: (id: string) => void;
  onChangeStatus: (id: string, change: StatusChange) => void;
}) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const app = apps.find((a) => a.id === e.active.id);
    if (!app) return;
    const change = boardChangeFor(
      app,
      history.filter((h) => h.applicationId === app.id),
      e.over.id as BoardColumn,
      new Date(),
    );
    if (change) onChangeStatus(app.id, change);
  };

  return (
    <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
      <div className="space-y-3">
        <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2 md:mx-0 md:px-0">
          {BOARD_COLUMNS.map((c) => (
            <Column key={c} column={c} apps={columnApps(apps, c)} onOpen={onOpen} />
          ))}
        </div>
        <RejectZone />
      </div>
    </DndContext>
  );
}
