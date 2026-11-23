import type { Application, HistoryEntry } from './types';

export function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    appliedAt: '2026-08-14',
    company: 'GR8_TECH',
    position: 'Senior Front End Developer',
    url: 'https://djinni.co/jobs/838834',
    source: 'djinni',
    status: 'sent',
    interviewStage: null,
    nextEventAt: null,
    salaryAsked: '',
    salaryListed: '',
    contact: '',
    notes: '',
    createdAt: '2026-08-14T10:00:00.000Z',
    updatedAt: '2026-08-14T10:00:00.000Z',
    ...overrides,
  };
}

export function makeHistory(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'h1',
    applicationId: 'a1',
    status: 'sent',
    interviewStage: null,
    at: '2026-08-14',
    note: '',
    ...overrides,
  };
}
