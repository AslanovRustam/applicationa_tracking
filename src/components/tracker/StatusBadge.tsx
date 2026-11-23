import { statusBadgeLabel } from '@/lib/domain/status';
import type { Application, Status } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

export const STATUS_COLORS: Record<Status, string> = {
  sent: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900',
  screening: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900',
  interview: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
  offer: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-300 dark:ring-green-900',
  rejected: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900',
  ghosted: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800',
  archived: 'bg-stone-100 text-stone-600 ring-stone-300 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-700',
};

export function StatusBadge({ app, className }: { app: Pick<Application, 'status' | 'interviewStage'>; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        STATUS_COLORS[app.status],
        className,
      )}
    >
      {statusBadgeLabel(app)}
    </span>
  );
}

export function StaleMark() {
  return (
    <span className="whitespace-nowrap rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
      нет ответа 30+ дн
    </span>
  );
}
