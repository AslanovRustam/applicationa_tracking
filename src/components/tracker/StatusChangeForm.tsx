'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { STATUS_LABELS, nextInterviewStage } from '@/lib/domain/status';
import { nowInKyiv } from '@/lib/domain/time';
import { STATUSES, type Application, type HistoryEntry, type Status, type StatusChange } from '@/lib/domain/types';

export function StatusChangeForm({
  app,
  appHistory,
  onSubmit,
}: {
  app: Application;
  appHistory: HistoryEntry[];
  onSubmit: (change: StatusChange) => void;
}) {
  const [status, setStatus] = useState<Status>(app.status === 'sent' ? 'screening' : app.status);
  const [stage, setStage] = useState(() => nextInterviewStage(appHistory));
  const [at, setAt] = useState(() => nowInKyiv(new Date()));
  const [note, setNote] = useState('');

  return (
    <form
      className="grid gap-2 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!at) return;
        onSubmit({ status, interviewStage: status === 'interview' ? stage : null, at, note: note.trim() });
        setNote('');
      }}
    >
      <div className="text-xs font-medium text-muted-foreground">Сменить статус</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor="sc-status" className="text-xs">
            Статус
          </Label>
          <NativeSelect id="sc-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {status === 'interview' ? (
          <div className="grid gap-1">
            <Label htmlFor="sc-stage" className="text-xs">
              Этап
            </Label>
            <Input
              id="sc-stage"
              type="number"
              min={1}
              value={stage}
              onChange={(e) => setStage(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        ) : (
          <div />
        )}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="sc-at" className="text-xs">
          Когда
        </Label>
        <Input id="sc-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка (необязательно)" aria-label="Заметка" />
      <Button type="submit" size="sm" className="justify-self-start">
        Сохранить статус
      </Button>
    </form>
  );
}
