'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { copyText } from '@/lib/clipboard';
import { fillTemplate } from '@/lib/domain/template';
import type { Application } from '@/lib/domain/types';

interface Pending {
  text: string;
  app: Application | null;
  missing: string[];
}

async function copyAndNotify(text: string) {
  if (await copyText(text)) toast.success('Скопировано');
  else toast.error('Не удалось скопировать — браузер запретил доступ к буферу обмена');
}

/** Copies a template with variables filled; asks for any missing values first. */
export function useCopyTemplate() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const copyTemplate = (text: string, app: Application | null) => {
    const filled = fillTemplate(text, app, {});
    if (filled.missing.length === 0) {
      void copyAndNotify(filled.text);
      return;
    }
    setValues({});
    setPending({ text, app, missing: filled.missing });
  };

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Заполните переменные</DialogTitle>
          <DialogDescription>Этих значений нет в отклике.</DialogDescription>
        </DialogHeader>
        {pending && (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const filled = fillTemplate(pending.text, pending.app, values);
              setPending(null);
              void copyAndNotify(filled.text);
            }}
          >
            {pending.missing.map((name, i) => (
              <div key={name} className="grid gap-1.5">
                <Label htmlFor={`var-${name}`}>{`{${name}}`}</Label>
                <Input
                  id={`var-${name}`}
                  autoFocus={i === 0}
                  value={values[name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                />
              </div>
            ))}
            <Button type="submit">Скопировать</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );

  return { copyTemplate, copyPlain: copyAndNotify, dialog };
}
