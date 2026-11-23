import type { Summary } from '@/lib/domain/summary';
import { formatShortDateTime } from '@/lib/domain/time';

function Card({ value, label, accent }: { value: React.ReactNode; label: string; accent?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className={`truncate text-2xl font-semibold tabular-nums ${accent ?? ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function SummaryCards({ summary, onOpenEvent }: { summary: Summary; onOpenEvent: (id: string) => void }) {
  const next = summary.nextEvent;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card value={summary.lastWeek} label="откликов за неделю" />
      <Card value={summary.total} label="всего откликов" />
      <Card value={summary.inProgress} label="в процессе" accent="text-amber-700 dark:text-amber-400" />
      {next ? (
        <button type="button" onClick={() => onOpenEvent(next.applicationId)} className="text-left">
          <Card
            value={<span className="text-base font-semibold">{next.company}</span>}
            label={`ближайшее: ${formatShortDateTime(next.at)}`}
            accent="text-blue-700 dark:text-blue-400"
          />
        </button>
      ) : (
        <Card value="—" label="ближайших событий нет" />
      )}
    </div>
  );
}
