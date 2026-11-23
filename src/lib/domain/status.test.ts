import { describe, expect, it } from 'vitest';
import { isStale, nextInterviewStage, sortHistoryDesc, statusBadgeLabel } from './status';
import { makeApp, makeHistory } from './test-helpers';

describe('isStale', () => {
  const today = '2026-11-23';

  it('flags sent applications 30 days old', () => {
    expect(isStale(makeApp({ status: 'sent', appliedAt: '2026-10-24' }), today)).toBe(true);
  });

  it('does not flag sent applications 29 days old', () => {
    expect(isStale(makeApp({ status: 'sent', appliedAt: '2026-10-25' }), today)).toBe(false);
  });

  it('does not flag rejected applications', () => {
    expect(isStale(makeApp({ status: 'rejected', appliedAt: '2026-08-25' }), today)).toBe(false);
  });
});

describe('nextInterviewStage', () => {
  it('is 1 with no interviews in history', () => {
    expect(nextInterviewStage([])).toBe(1);
    expect(nextInterviewStage([makeHistory({ status: 'screening' })])).toBe(1);
  });

  it('is one more than the highest interview stage', () => {
    expect(
      nextInterviewStage([
        makeHistory({ status: 'interview', interviewStage: 1 }),
        makeHistory({ status: 'interview', interviewStage: 2 }),
      ]),
    ).toBe(3);
  });
});

describe('statusBadgeLabel', () => {
  it('shows interview stage', () => {
    expect(statusBadgeLabel({ status: 'interview', interviewStage: 2 })).toBe('Собес 2');
  });

  it('uses plain labels for other statuses', () => {
    expect(statusBadgeLabel({ status: 'rejected', interviewStage: null })).toBe('Отказ');
    expect(statusBadgeLabel({ status: 'ghosted', interviewStage: null })).toBe('Тишина');
  });
});

describe('archived status', () => {
  it('is labelled Архив', () => {
    expect(statusBadgeLabel({ status: 'archived', interviewStage: null })).toBe('Архив');
  });
});

describe('sortHistoryDesc', () => {
  it('puts the latest change first, using record order to break same-minute ties', () => {
    const entries = [
      makeHistory({ id: 'sent', status: 'sent', at: '2026-11-20' }),
      makeHistory({ id: 'scr', status: 'screening', at: '2026-11-23T23:05' }),
      makeHistory({ id: 'arc', status: 'archived', at: '2026-11-23T23:05' }),
    ];
    expect(sortHistoryDesc(entries).map((h) => h.id)).toEqual(['arc', 'scr', 'sent']);
  });
});
