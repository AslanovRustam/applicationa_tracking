import { describe, expect, it } from 'vitest';
import { computeSummary } from './summary';
import { makeApp } from './test-helpers';

const now = new Date('2026-11-23T10:00:00Z'); // 12:00 in Kyiv

describe('computeSummary', () => {
  it('counts applications from the last 7 Kyiv days', () => {
    const s = computeSummary(
      [
        makeApp({ id: '1', appliedAt: '2026-11-23' }),
        makeApp({ id: '2', appliedAt: '2026-11-17' }),
        makeApp({ id: '3', appliedAt: '2026-11-16' }),
      ],
      now,
    );
    expect(s.lastWeek).toBe(2);
    expect(s.total).toBe(3);
  });

  it('counts only active statuses as in progress', () => {
    const s = computeSummary(
      [
        makeApp({ id: '1', status: 'screening' }),
        makeApp({ id: '2', status: 'interview', interviewStage: 1 }),
        makeApp({ id: '3', status: 'offer' }),
        makeApp({ id: '4', status: 'rejected' }),
        makeApp({ id: '5', status: 'sent' }),
      ],
      now,
    );
    expect(s.inProgress).toBe(3);
  });

  it('picks the nearest future event, ignoring past and closed ones', () => {
    const s = computeSummary(
      [
        makeApp({ id: 'past', company: 'Past', status: 'interview', nextEventAt: '2026-11-23T11:00' }),
        makeApp({ id: 'closed', company: 'Closed', status: 'rejected', nextEventAt: '2026-11-23T13:00' }),
        makeApp({ id: 'later', company: 'Later', status: 'screening', nextEventAt: '2026-11-25T10:00' }),
        makeApp({ id: 'soon', company: 'Soon', status: 'interview', nextEventAt: '2026-11-24T14:00' }),
      ],
      now,
    );
    expect(s.nextEvent).toEqual({ applicationId: 'soon', company: 'Soon', at: '2026-11-24T14:00' });
  });

  it('has no next event when nothing is scheduled', () => {
    expect(computeSummary([makeApp()], now).nextEvent).toBeNull();
  });
});
