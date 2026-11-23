'use client';

import { ExternalLinkIcon, MoonIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SOURCE_LABELS } from '@/lib/domain/source';
import { isStale } from '@/lib/domain/status';
import { todayInKyiv } from '@/lib/domain/time';
import { SOURCES, type Application, type HistoryEntry, type Source } from '@/lib/domain/types';
import type { TrackerState } from './use-tracker-state';
import { ConfirmDialog } from './ConfirmDialog';
import { EditableField } from './EditableField';
import { HistoryTimeline } from './HistoryTimeline';
import { StatusBadge } from './StatusBadge';
import { StatusChangeForm } from './StatusChangeForm';

export function ApplicationDrawer({
  app,
  appHistory,
  state,
  onClose,
  actionsSlot,
}: {
  app: Application | null;
  appHistory: HistoryEntry[];
  state: Pick<TrackerState, 'update' | 'changeStatus' | 'remove'>;
  onClose: () => void;
  actionsSlot?: React.ReactNode;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Sheet open={app !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {app && (
          <DrawerBody
            key={app.id}
            app={app}
            appHistory={appHistory}
            state={state}
            actionsSlot={actionsSlot}
            onDelete={() => setConfirmDelete(true)}
          />
        )}
      </SheetContent>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Удалить отклик в ${app?.company ?? ''}?`}
        description="Отклик и вся его история будут удалены. Это нельзя отменить."
        confirmLabel="Удалить"
        destructive
        onConfirm={() => {
          if (!app) return;
          const id = app.id;
          onClose();
          void state.remove(id);
        }}
      />
    </Sheet>
  );
}

function DrawerBody({
  app,
  appHistory,
  state,
  actionsSlot,
  onDelete,
}: {
  app: Application;
  appHistory: HistoryEntry[];
  state: Pick<TrackerState, 'update' | 'changeStatus' | 'remove'>;
  actionsSlot?: React.ReactNode;
  onDelete: () => void;
}) {
  const pending = app.id.startsWith('tmp-');
  const stale = isStale(app, todayInKyiv(new Date()));
  const update = (patch: Parameters<TrackerState['update']>[1]) => void state.update(app.id, patch);

  return (
    <>
      <SheetHeader className="border-b pb-3">
        <SheetTitle className="pr-8 text-lg">{app.company}</SheetTitle>
        <SheetDescription>{app.position}</SheetDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <StatusBadge app={app} />
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Открыть вакансию <ExternalLinkIcon className="size-3.5" />
            </a>
          )}
        </div>
      </SheetHeader>

      {pending ? (
        <p className="px-4 text-sm text-muted-foreground">Сохраняется…</p>
      ) : (
        <div className="grid gap-5 px-4 pb-6">
          {actionsSlot && <div className="flex flex-wrap gap-2">{actionsSlot}</div>}

          {stale && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">
              <span>Нет ответа 30+ дней</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void state.changeStatus(app.id, { status: 'ghosted', interviewStage: null, at: todayInKyiv(new Date()), note: '' })
                }
              >
                <MoonIcon /> Отметить как Тишина
              </Button>
            </div>
          )}

          <StatusChangeForm
            key={`${app.status}-${appHistory.length}`}
            app={app}
            appHistory={appHistory}
            onSubmit={(change) => void state.changeStatus(app.id, change)}
          />

          <section className="grid gap-3">
            <EditableField id="d-company" label="Компания" value={app.company} required onCommit={(v) => update({ company: v })} />
            <EditableField id="d-position" label="Должность" value={app.position} required onCommit={(v) => update({ position: v })} />
            <EditableField id="d-url" label="Ссылка" type="url" value={app.url} onCommit={(v) => update({ url: v })} />
            <div className="grid grid-cols-2 gap-3">
              <EditableField
                id="d-applied"
                label="Дата отклика"
                type="date"
                value={app.appliedAt}
                required
                onCommit={(v) => update({ appliedAt: v })}
              />
              <div className="grid gap-1">
                <Label htmlFor="d-source" className="text-xs text-muted-foreground">
                  Источник
                </Label>
                <NativeSelect id="d-source" value={app.source} onChange={(e) => update({ source: e.target.value as Source })}>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <EditableField id="d-asked" label="ЗП — просил" value={app.salaryAsked} onCommit={(v) => update({ salaryAsked: v })} />
              <EditableField id="d-listed" label="ЗП — вилка" value={app.salaryListed} onCommit={(v) => update({ salaryListed: v })} />
            </div>
            <EditableField
              id="d-event"
              label="Ближайшее событие (собес, звонок)"
              type="datetime-local"
              value={app.nextEventAt ?? ''}
              onCommit={(v) => update({ nextEventAt: v || null })}
            />
            <EditableField id="d-contact" label="Контакт рекрутера" value={app.contact} onCommit={(v) => update({ contact: v })} />
            <EditableField id="d-notes" label="Заметки" multiline value={app.notes} onCommit={(v) => update({ notes: v })} />
          </section>

          <section className="grid gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">История</h3>
            <HistoryTimeline entries={appHistory} />
          </section>

          <Button variant="destructive" size="sm" className="justify-self-start" onClick={onDelete}>
            <Trash2Icon /> Удалить отклик
          </Button>
        </div>
      )}
    </>
  );
}
