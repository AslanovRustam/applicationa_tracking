'use client';

import { MoonIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { plural as pluralize } from '@/lib/plural';
import { ConfirmDialog } from './ConfirmDialog';

const plural = (n: number) => pluralize(n, ['отклик', 'отклика', 'откликов']);

export function StaleBanner({ staleIds, onMarkAll }: { staleIds: string[]; onMarkAll: (ids: string[]) => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!staleIds.length) return null;
  const n = staleIds.length;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-100">
      <span>
        {n} {plural(n)} без ответа 30+ дней
      </span>
      <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>
        <MoonIcon /> Отметить все как Тишина
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Отметить ${n} ${plural(n)} как «Тишина»?`}
        description="Статус можно будет поменять обратно в карточке отклика."
        confirmLabel="Отметить"
        onConfirm={() => onMarkAll(staleIds)}
      />
    </div>
  );
}
