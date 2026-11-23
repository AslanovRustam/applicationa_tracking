import { sortHistoryDesc } from '@/lib/domain/status';
import { formatShortDateTime } from '@/lib/domain/time';
import type { HistoryEntry } from '@/lib/domain/types';
import { StatusBadge } from './StatusBadge';

export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  const sorted = sortHistoryDesc(entries);
  if (!sorted.length) return <p className="text-sm text-muted-foreground">История пуста.</p>;
  return (
    <ol className="space-y-2 border-l-2 pl-3">
      {sorted.map((h) => (
        <li key={h.id} className="text-sm">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{formatShortDateTime(h.at)}</span>
            <StatusBadge app={h} />
          </div>
          {h.note && <p className="mt-0.5 pl-26 text-muted-foreground">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}
