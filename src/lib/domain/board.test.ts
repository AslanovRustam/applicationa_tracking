import { describe, expect, it } from 'vitest';
import { boardChangeFor } from './board';
import { makeApp, makeHistory } from './test-helpers';

const now = new Date('2026-11-23T10:00:00Z'); // 12:00 Kyiv

describe('boardChangeFor', () => {
  it('moves screening to interview stage 1 when there were no interviews', () => {
    expect(boardChangeFor(makeApp({ status: 'screening' }), [], 'interview', now)).toEqual({
      status: 'interview',
      interviewStage: 1,
      at: '2026-11-23T12:00',
      note: '',
    });
  });

  it('uses the next stage after earlier interviews', () => {
    const history = [makeHistory({ status: 'interview', interviewStage: 1 })];
    expect(boardChangeFor(makeApp({ status: 'screening' }), history, 'interview', now)?.interviewStage).toBe(2);
  });

  it('clears the stage when moving to offer', () => {
    expect(boardChangeFor(makeApp({ status: 'interview', interviewStage: 2 }), [], 'offer', now)?.interviewStage).toBeNull();
  });

  it('returns null when dropped on the same column', () => {
    expect(boardChangeFor(makeApp({ status: 'interview', interviewStage: 1 }), [], 'interview', now)).toBeNull();
    expect(boardChangeFor(makeApp({ status: 'offer' }), [], 'offer', now)).toBeNull();
  });

  it('rejects', () => {
    expect(boardChangeFor(makeApp({ status: 'offer' }), [], 'rejected', now)).toEqual({
      status: 'rejected',
      interviewStage: null,
      at: '2026-11-23T12:00',
      note: '',
    });
  });
});
