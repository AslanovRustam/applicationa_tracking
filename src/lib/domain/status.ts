import { addDays } from './time';
import type { Application, HistoryEntry, Status } from './types';

export const STATUS_LABELS: Record<Status, string> = {
  sent: 'Отправлен',
  screening: 'Скрининг',
  interview: 'Собеседование',
  offer: 'Оффер',
  rejected: 'Отказ',
  ghosted: 'Тишина',
};

export const ACTIVE_STATUSES: Status[] = ['screening', 'interview', 'offer'];

export const STALE_DAYS = 30;

export function statusBadgeLabel(a: Pick<Application, 'status' | 'interviewStage'>): string {
  if (a.status === 'interview') return a.interviewStage ? `Собес ${a.interviewStage}` : 'Собес';
  return STATUS_LABELS[a.status];
}

/** `sent` is the initial status, so its date is `appliedAt`. */
export function isStale(a: Application, today: string): boolean {
  return a.status === 'sent' && a.appliedAt <= addDays(today, -STALE_DAYS);
}

export function nextInterviewStage(appHistory: HistoryEntry[]): number {
  let max = 0;
  for (const h of appHistory) {
    if (h.status === 'interview' && h.interviewStage && h.interviewStage > max) max = h.interviewStage;
  }
  return max + 1;
}
