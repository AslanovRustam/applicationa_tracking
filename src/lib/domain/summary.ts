import { ACTIVE_STATUSES } from './status';
import { addDays, nowInKyiv, todayInKyiv } from './time';
import type { Application } from './types';

export interface Summary {
  lastWeek: number;
  total: number;
  inProgress: number;
  nextEvent: { applicationId: string; company: string; at: string } | null;
}

export function computeSummary(apps: Application[], now: Date): Summary {
  const today = todayInKyiv(now);
  const weekStart = addDays(today, -6);
  const nowLocal = nowInKyiv(now);

  let lastWeek = 0;
  let inProgress = 0;
  let nextEvent: Summary['nextEvent'] = null;

  for (const a of apps) {
    if (a.appliedAt >= weekStart && a.appliedAt <= today) lastWeek++;
    if (ACTIVE_STATUSES.includes(a.status)) inProgress++;
    if (
      a.nextEventAt &&
      a.status !== 'rejected' &&
      a.status !== 'ghosted' &&
      a.status !== 'archived' &&
      a.nextEventAt >= nowLocal &&
      (!nextEvent || a.nextEventAt < nextEvent.at)
    ) {
      nextEvent = { applicationId: a.id, company: a.company, at: a.nextEventAt };
    }
  }

  return { lastWeek, total: apps.length, inProgress, nextEvent };
}
