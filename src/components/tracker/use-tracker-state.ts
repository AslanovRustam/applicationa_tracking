'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  changeStatusAction,
  createApplicationAction,
  deleteApplicationAction,
  markGhostedAction,
  updateApplicationAction,
} from '@/app/actions';
import { detectSource } from '@/lib/domain/source';
import { todayInKyiv } from '@/lib/domain/time';
import type { Application, HistoryEntry, StatusChange } from '@/lib/domain/types';
import type { ApplicationPatch, NewApplicationInput } from '@/lib/repo/inputs';
import type { AllData } from '@/lib/repo/repo';
import { safeAction } from '@/lib/safe-action';

export interface TrackerState {
  applications: Application[];
  history: HistoryEntry[];
  /** Applications whose creation has not been confirmed by the server yet. */
  pendingIds: ReadonlySet<string>;
  create(input: NewApplicationInput): Promise<boolean>;
  update(id: string, patch: ApplicationPatch): Promise<boolean>;
  changeStatus(id: string, change: StatusChange): Promise<boolean>;
  markGhosted(ids: string[]): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}

type Op =
  | { kind: 'create'; input: NewApplicationInput & { id: string } }
  | { kind: 'update'; id: string; patch: ApplicationPatch }
  | { kind: 'status'; id: string; change: StatusChange }
  | { kind: 'ghost'; ids: string[] }
  | { kind: 'remove'; id: string };

const newId = () => crypto.randomUUID();

function pick<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

export function useTrackerState(initial: Pick<AllData, 'applications' | 'history'>): TrackerState {
  const [applications, setApplications] = useState(initial.applications);
  const [history, setHistory] = useState(initial.history);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const appsRef = useRef(initial.applications);
  const historyRef = useRef(initial.history);
  const execRef = useRef<(op: Op) => Promise<boolean>>(async () => false);

  useEffect(() => {
    appsRef.current = applications;
    historyRef.current = history;
  }, [applications, history]);

  /** Merges `fields` into the listed applications only — never touches other fields or rows. */
  const patchApps = (fields: Map<string, Partial<Application>>) =>
    setApplications((prev) => prev.map((a) => (fields.has(a.id) ? { ...a, ...fields.get(a.id) } : a)));
  const patchOne = (id: string, fields: Partial<Application>) => patchApps(new Map([[id, fields]]));

  const setPending = (id: string, on: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const fail = (error: string, op: Op) => {
    toast.error('Не удалось сохранить', {
      description: error,
      duration: 10000,
      action: { label: 'Повторить', onClick: () => void execRef.current(op) },
    });
    return false;
  };

  async function exec(op: Op): Promise<boolean> {
    switch (op.kind) {
      case 'create': {
        const { input } = op;
        const id = input.id;
        const now = new Date();
        const optimistic: Application = {
          id,
          appliedAt: input.appliedAt ?? todayInKyiv(now),
          company: input.company.trim(),
          position: input.position.trim(),
          url: (input.url ?? '').trim(),
          source: input.source ?? detectSource(input.url ?? ''),
          status: 'sent',
          interviewStage: null,
          nextEventAt: null,
          salaryAsked: input.salaryAsked ?? '',
          salaryListed: input.salaryListed ?? '',
          contact: input.contact ?? '',
          notes: input.notes ?? '',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        setApplications((prev) => [optimistic, ...prev.filter((a) => a.id !== id)]);
        setPending(id, true);
        const res = await safeAction(() => createApplicationAction(input));
        setPending(id, false);
        if (res.ok) {
          setApplications((prev) => prev.map((a) => (a.id === id ? res.data.application : a)));
          setHistory((prev) => [...prev.filter((h) => h.id !== res.data.history.id), res.data.history]);
          return true;
        }
        setApplications((prev) => prev.filter((a) => a.id !== id));
        return fail(res.error, op);
      }

      case 'update': {
        const before = appsRef.current.find((a) => a.id === op.id);
        if (!before) return false;
        const keys = Object.keys(op.patch) as (keyof Application)[];
        patchOne(op.id, op.patch);
        const res = await safeAction(() => updateApplicationAction(op.id, op.patch));
        if (res.ok) {
          patchOne(op.id, { ...pick(res.data, keys), updatedAt: res.data.updatedAt });
          return true;
        }
        patchOne(op.id, pick(before, keys));
        return fail(res.error, op);
      }

      case 'status': {
        const before = appsRef.current.find((a) => a.id === op.id);
        if (!before) return false;
        const stage = op.change.status === 'interview' ? op.change.interviewStage : null;
        const localHistory: HistoryEntry = { id: newId(), applicationId: op.id, ...op.change, interviewStage: stage };
        patchOne(op.id, { status: op.change.status, interviewStage: stage });
        setHistory((prev) => [...prev, localHistory]);
        const res = await safeAction(() => changeStatusAction(op.id, op.change));
        setHistory((prev) => prev.filter((h) => h.id !== localHistory.id));
        if (res.ok) {
          const a = res.data.application;
          patchOne(op.id, { status: a.status, interviewStage: a.interviewStage, updatedAt: a.updatedAt });
          setHistory((prev) => [...prev, res.data.history]);
          return true;
        }
        patchOne(op.id, { status: before.status, interviewStage: before.interviewStage });
        return fail(res.error, op);
      }

      case 'ghost': {
        const before = appsRef.current.filter((a) => op.ids.includes(a.id));
        patchApps(new Map(before.map((a) => [a.id, { status: 'ghosted' as const, interviewStage: null }])));
        const res = await safeAction(() => markGhostedAction(op.ids));
        if (res.ok) {
          patchApps(new Map(res.data.applications.map((a) => [a.id, pick(a, ['status', 'interviewStage', 'updatedAt'])])));
          setHistory((prev) => [...prev, ...res.data.history]);
          return true;
        }
        patchApps(new Map(before.map((a) => [a.id, pick(a, ['status', 'interviewStage'])])));
        return fail(res.error, op);
      }

      case 'remove': {
        const index = appsRef.current.findIndex((a) => a.id === op.id);
        if (index === -1) return false;
        const before = appsRef.current[index];
        const beforeHistory = historyRef.current.filter((h) => h.applicationId === op.id);
        setApplications((prev) => prev.filter((a) => a.id !== op.id));
        setHistory((prev) => prev.filter((h) => h.applicationId !== op.id));
        const res = await safeAction(() => deleteApplicationAction(op.id));
        if (res.ok) return true;
        setApplications((prev) =>
          prev.some((a) => a.id === op.id) ? prev : [...prev.slice(0, index), before, ...prev.slice(index)],
        );
        setHistory((prev) => [...prev, ...beforeHistory.filter((h) => !prev.some((p) => p.id === h.id))]);
        return fail(res.error, op);
      }
    }
  }

  useEffect(() => {
    execRef.current = exec;
  });

  return {
    applications,
    history,
    pendingIds,
    create: (input) => exec({ kind: 'create', input: { ...input, id: input.id ?? newId() } }),
    update: (id, patch) => exec({ kind: 'update', id, patch }),
    changeStatus: (id, change) => exec({ kind: 'status', id, change }),
    markGhosted: (ids) => exec({ kind: 'ghost', ids }),
    remove: (id) => exec({ kind: 'remove', id }),
  };
}
