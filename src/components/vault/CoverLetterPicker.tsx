'use client';

import { ClipboardCopyIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Application, VaultItem } from '@/lib/domain/types';
import { useCopyTemplate } from './use-copy-template';

export function CoverLetterPicker({ application, items }: { application: Application; items: VaultItem[] }) {
  const { copyTemplate, dialog } = useCopyTemplate();
  const texts = items.filter((i) => i.type === 'text');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ClipboardCopyIcon /> Скопировать сопроводительное
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-80">
          <DropdownMenuLabel>Шаблоны с данными этого отклика</DropdownMenuLabel>
          {texts.length === 0 ? (
            <DropdownMenuItem asChild>
              <Link href="/vault">Шаблонов нет — добавить в Копилке</Link>
            </DropdownMenuItem>
          ) : (
            texts.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => copyTemplate(t.content, application)}>
                <span className="truncate">{t.title}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  );
}
