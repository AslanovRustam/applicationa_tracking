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

export interface TrackerState {
  applications: Application[];
  history: HistoryEntry[];
  create(input: NewApplicationInput): Promise<boolean>;
  update(id: string, patch: ApplicationPatch): Promise<boolean>;
  changeStatus(id: string, change: StatusChange): Promise<boolean>;
  markGhosted(ids: string[]): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}

type Op =
  | { kind: 'create'; input: NewApplicationInput }
  | { kind: 'update'; id: string; patch: ApplicationPatch }
  | { kind: 'status'; id: string; change: StatusChange }
  | { kind: 'ghost'; ids: string[] }
  | { kind: 'remove'; id: string };

let tmpCounter = 0;
const tmpId = () => `tmp-${Date.now()}-${++tmpCounter}`;

export function useTrackerState(initial: Pick<AllData, 'applications' | 'history'>): TrackerState {
  const [applications, setApplications] = useState(initial.applications);
  const [history, setHistory] = useState(initial.history);
  const appsRef = useRef(initial.applications);
  const historyRef = useRef(initial.history);
  const execRef = useRef<(op: Op) => Promise<boolean>>(async () => false);

  useEffect(() => {
    appsRef.current = applications;
    historyRef.current = history;
  }, [applications, history]);

  const replaceApps = (updated: Application[]) =>
    setApplications((prev) => {
      const byId = new Map(updated.map((a) => [a.id, a]));
      return prev.map((a) => byId.get(a.id) ?? a);
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
        const now = new Date();
        const id = tmpId();
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
        setApplications((prev) => [optimistic, ...prev]);
        const res = await createApplicationAction(input);
        if (res.ok) {
          setApplications((prev) => prev.map((a) => (a.id === id ? res.data.application : a)));
          setHistory((prev) => [...prev, res.data.history]);
          return true;
        }
        setApplications((prev) => prev.filter((a) => a.id !== id));
        return fail(res.error, op);
      }

      case 'update': {
        const before = appsRef.current.find((a) => a.id === op.id);
        if (!before) return false;
        replaceApps([{ ...before, ...op.patch }]);
        const res = await updateApplicationAction(op.id, op.patch);
        if (res.ok) {
          replaceApps([res.data]);
          return true;
        }
        replaceApps([before]);
        return fail(res.error, op);
      }

      case 'status': {
        const before = appsRef.current.find((a) => a.id === op.id);
        if (!before) return false;
        const stage = op.change.status === 'interview' ? op.change.interviewStage : null;
        const localHistory: HistoryEntry = { id: tmpId(), applicationId: op.id, ...op.change, interviewStage: stage };
        replaceApps([{ ...before, status: op.change.status, interviewStage: stage }]);
        setHistory((prev) => [...prev, localHistory]);
        const res = await changeStatusAction(op.id, op.change);
        setHistory((prev) => prev.filter((h) => h.id !== localHistory.id));
        if (res.ok) {
          replaceApps([res.data.application]);
          setHistory((prev) => [...prev, res.data.history]);
          return true;
        }
        replaceApps([before]);
        return fail(res.error, op);
      }

      case 'ghost': {
        const before = appsRef.current.filter((a) => op.ids.includes(a.id));
        replaceApps(before.map((a) => ({ ...a, status: 'ghosted', interviewStage: null })));
        const res = await markGhostedAction(op.ids);
        if (res.ok) {
          replaceApps(res.data.applications);
          setHistory((prev) => [...prev, ...res.data.history]);
          return true;
        }
        replaceApps(before);
        return fail(res.error, op);
      }

      case 'remove': {
        const index = appsRef.current.findIndex((a) => a.id === op.id);
        if (index === -1) return false;
        const before = appsRef.current[index];
        const beforeHistory = historyRef.current.filter((h) => h.applicationId === op.id);
        setApplications((prev) => prev.filter((a) => a.id !== op.id));
        setHistory((prev) => prev.filter((h) => h.applicationId !== op.id));
        const res = await deleteApplicationAction(op.id);
        if (res.ok) return true;
        setApplications((prev) => [...prev.slice(0, index), before, ...prev.slice(index)]);
        setHistory((prev) => [...prev, ...beforeHistory]);
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
    create: (input) => exec({ kind: 'create', input }),
    update: (id, patch) => exec({ kind: 'update', id, patch }),
    changeStatus: (id, change) => exec({ kind: 'status', id, change }),
    markGhosted: (ids) => exec({ kind: 'ghost', ids }),
    remove: (id) => exec({ kind: 'remove', id }),
  };
}
