import { nextInterviewStage } from './status';
import { nowInKyiv } from './time';
import type { Application, HistoryEntry, StatusChange } from './types';

export type BoardColumn = 'screening' | 'interview' | 'offer' | 'rejected';

export const BOARD_COLUMNS: BoardColumn[] = ['screening', 'interview', 'offer'];

export function boardChangeFor(
  app: Application,
  appHistory: HistoryEntry[],
  target: BoardColumn,
  now: Date,
): StatusChange | null {
  if (app.status === target) return null;
  return {
    status: target,
    interviewStage: target === 'interview' ? nextInterviewStage(appHistory) : null,
    at: nowInKyiv(now),
    note: '',
  };
}
