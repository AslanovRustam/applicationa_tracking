'use client';

import { ArrowDownIcon, ArrowUpIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ItemMenu({
  label,
  onEdit,
  onUp,
  onDown,
  onDelete,
  editLabel = 'Изменить',
}: {
  label: string;
  onEdit: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  editLabel?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Действия: ${label}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <PencilIcon /> {editLabel}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onUp}>
          <ArrowUpIcon /> Выше
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDown}>
          <ArrowDownIcon /> Ниже
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2Icon /> Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
