import { ACTIVE_STATUSES } from './status';
import type { Application, Source, Status } from './types';

export type StatusGroup = 'all' | 'waiting' | 'active' | 'rejected' | 'ghosted';

export interface Filters {
  query: string;
  group: StatusGroup;
  source: Source | 'all';
}

export type SortKey = 'appliedAt' | 'company' | 'status';

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  all: 'Все',
  waiting: 'Ждут ответа',
  active: 'В процессе',
  rejected: 'Отказ',
  ghosted: 'Тишина',
};

function inGroup(status: Status, group: StatusGroup): boolean {
  switch (group) {
    case 'all':
      return true;
    case 'waiting':
      return status === 'sent';
    case 'active':
      return ACTIVE_STATUSES.includes(status);
    case 'rejected':
      return status === 'rejected';
    case 'ghosted':
      return status === 'ghosted';
  }
}

export function filterApplications(apps: Application[], f: Filters): Application[] {
  const q = f.query.trim().toLowerCase();
  return apps.filter(
    (a) =>
      inGroup(a.status, f.group) &&
      (f.source === 'all' || a.source === f.source) &&
      (!q || a.company.toLowerCase().includes(q) || a.position.toLowerCase().includes(q)),
  );
}

export function groupCounts(apps: Application[]): Record<StatusGroup, number> {
  const groups: StatusGroup[] = ['all', 'waiting', 'active', 'rejected', 'ghosted'];
  const counts = {} as Record<StatusGroup, number>;
  for (const g of groups) counts[g] = apps.filter((a) => inGroup(a.status, g)).length;
  return counts;
}

const STATUS_ORDER: Record<Status, number> = {
  offer: 0,
  interview: 1,
  screening: 2,
  sent: 3,
  ghosted: 4,
  rejected: 5,
};

export function sortApplications(apps: Application[], key: SortKey, dir: 'asc' | 'desc'): Application[] {
  const sign = dir === 'asc' ? 1 : -1;
  const compare = (a: Application, b: Application): number => {
    let c = 0;
    if (key === 'appliedAt') c = a.appliedAt.localeCompare(b.appliedAt);
    else if (key === 'company') c = a.company.localeCompare(b.company, 'ru', { sensitivity: 'base' });
    else c = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (c === 0) c = a.createdAt.localeCompare(b.createdAt);
    return c * sign;
  };
  return [...apps].sort(compare);
}
