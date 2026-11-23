'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { SOURCE_LABELS, detectSource } from '@/lib/domain/source';
import { todayInKyiv } from '@/lib/domain/time';
import { SOURCES, type Source } from '@/lib/domain/types';
import type { NewApplicationInput } from '@/lib/repo/inputs';

interface FormState {
  url: string;
  company: string;
  position: string;
  appliedAt: string;
  source: Source;
  sourceTouched: boolean;
  salaryAsked: string;
  salaryListed: string;
  contact: string;
  notes: string;
}

const empty = (): FormState => ({
  url: '',
  company: '',
  position: '',
  appliedAt: todayInKyiv(new Date()),
  source: 'other',
  sourceTouched: false,
  salaryAsked: '',
  salaryListed: '',
  contact: '',
  notes: '',
});

export function ApplicationForm({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: NewApplicationInput) => Promise<boolean>;
}) {
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<{ company?: string; position?: string }>({});
  const urlRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onUrlChange = (url: string) =>
    setForm((f) => ({ ...f, url, source: f.sourceTouched ? f.source : detectSource(url) }));

  function submit(keepOpen: boolean) {
    const nextErrors = {
      company: form.company.trim() ? undefined : 'Укажите компанию',
      position: form.position.trim() ? undefined : 'Укажите должность',
    };
    setErrors(nextErrors);
    if (nextErrors.company || nextErrors.position) return;

    // Optimistic: the list updates immediately; failures are reported by a toast with "Повторить".
    void onSubmit({
      url: form.url.trim(),
      company: form.company.trim(),
      position: form.position.trim(),
      appliedAt: form.appliedAt,
      source: form.source,
      salaryAsked: form.salaryAsked.trim(),
      salaryListed: form.salaryListed.trim(),
      contact: form.contact.trim(),
      notes: form.notes,
    });
    setForm(empty());
    setErrors({});
    if (keepOpen) urlRef.current?.focus();
    else onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setForm(empty());
          setErrors({});
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[100dvh] overflow-y-auto max-sm:h-dvh max-sm:max-w-full max-sm:rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новый отклик</DialogTitle>
          <DialogDescription>Вставьте ссылку — источник определится сам.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="f-url">Ссылка на вакансию</Label>
            <Input
              id="f-url"
              ref={urlRef}
              autoFocus
              inputMode="url"
              value={form.url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://djinni.co/jobs/…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="f-company">Компания *</Label>
              <Input
                id="f-company"
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                aria-invalid={Boolean(errors.company)}
              />
              {errors.company && <p className="text-xs text-destructive">{errors.company}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-position">Должность *</Label>
              <Input
                id="f-position"
                value={form.position}
                onChange={(e) => set('position', e.target.value)}
                aria-invalid={Boolean(errors.position)}
              />
              {errors.position && <p className="text-xs text-destructive">{errors.position}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-date">Дата отклика</Label>
              <Input id="f-date" type="date" value={form.appliedAt} onChange={(e) => set('appliedAt', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-source">Источник</Label>
              <NativeSelect
                id="f-source"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as Source, sourceTouched: true }))}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-asked">ЗП — сколько просил</Label>
              <Input id="f-asked" value={form.salaryAsked} onChange={(e) => set('salaryAsked', e.target.value)} placeholder="3000$" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-listed">ЗП — вилка в вакансии</Label>
              <Input id="f-listed" value={form.salaryListed} onChange={(e) => set('salaryListed', e.target.value)} placeholder="4000–6000$" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-contact">Контакт рекрутера</Label>
            <Input id="f-contact" value={form.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Анна, @anna_hr" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-notes">Заметки</Label>
            <Textarea id="f-notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => submit(true)}>
              Сохранить и добавить ещё
            </Button>
            <Button type="submit">Сохранить</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
