// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeApp } from '@/lib/domain/test-helpers';

const actions = vi.hoisted(() => ({
  createApplicationAction: vi.fn(),
  updateApplicationAction: vi.fn(),
  changeStatusAction: vi.fn(),
  markGhostedAction: vi.fn(),
  deleteApplicationAction: vi.fn(),
}));
vi.mock('@/app/actions', () => actions);
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { useTrackerState } from './use-tracker-state';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const original = makeApp({ id: 'a1', notes: 'orig-notes', contact: 'orig-contact' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTrackerState', () => {
  it('rolls back and offers retry when the action request itself fails (offline, bad deploy)', async () => {
    actions.createApplicationAction.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useTrackerState({ applications: [], history: [] }));
    let ok = true;
    await act(async () => {
      ok = await result.current.create({ company: 'X', position: 'Y', url: '' });
    });
    expect(ok).toBe(false);
    expect(result.current.applications).toEqual([]);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error.mock.calls[0][1].action.label).toBe('Повторить');
  });

  it('sends a client id, marks it pending, and retries with the same id', async () => {
    const d = deferred<unknown>();
    actions.createApplicationAction.mockReturnValueOnce(d.promise);
    const { result } = renderHook(() => useTrackerState({ applications: [], history: [] }));
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.create({ company: 'X', position: 'Y', url: '' });
    });
    const sent = actions.createApplicationAction.mock.calls[0][0];
    expect(sent.id).toBeTruthy();
    expect(result.current.applications[0].id).toBe(sent.id);
    expect(result.current.pendingIds.has(sent.id)).toBe(true);

    await act(async () => {
      d.resolve({ ok: false, error: 'boom' });
      await pending;
    });
    actions.createApplicationAction.mockResolvedValueOnce({
      ok: true,
      data: { application: makeApp({ id: sent.id }), history: { id: 'h', applicationId: sent.id, status: 'sent', interviewStage: null, at: '2026-11-23', note: '' } },
    });
    await act(async () => {
      toast.error.mock.calls[0][1].action.onClick();
      await Promise.resolve();
    });
    expect(actions.createApplicationAction.mock.calls[1][0].id).toBe(sent.id);
    expect(result.current.applications.map((a) => a.id)).toEqual([sent.id]);
    expect(result.current.pendingIds.size).toBe(0);
  });

  it('rolls back only its own fields when overlapping updates fail out of order', async () => {
    const d1 = deferred<unknown>();
    const d2 = deferred<unknown>();
    actions.updateApplicationAction.mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
    const { result } = renderHook(() => useTrackerState({ applications: [original], history: [] }));
    let p1!: Promise<boolean>;
    let p2!: Promise<boolean>;
    act(() => {
      p1 = result.current.update('a1', { notes: 'new-notes' });
    });
    act(() => {
      p2 = result.current.update('a1', { contact: 'new-contact' });
    });
    await act(async () => {
      d1.resolve({ ok: false, error: 'x' });
      await p1;
    });
    await act(async () => {
      d2.resolve({ ok: false, error: 'x' });
      await p2;
    });
    expect(result.current.applications[0]).toMatchObject({ notes: 'orig-notes', contact: 'orig-contact' });
  });

  it('restores a removed application when the delete request fails', async () => {
    actions.deleteApplicationAction.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useTrackerState({ applications: [original], history: [] }));
    await act(async () => {
      await result.current.remove('a1');
    });
    expect(result.current.applications.map((a) => a.id)).toEqual(['a1']);
  });
});
