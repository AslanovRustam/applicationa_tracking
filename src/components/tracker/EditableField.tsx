'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** Shows the stored value; while focused keeps a local draft and commits it on blur / Enter. */
export function EditableField({
  id,
  label,
  value,
  onCommit,
  type = 'text',
  multiline = false,
  placeholder,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  type?: 'text' | 'date' | 'datetime-local' | 'url';
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;

  const commit = () => {
    if (draft === null) return;
    const next = type === 'text' || type === 'url' ? draft.trim() : draft;
    setDraft(null);
    if (next === value) return;
    if (required && !next) return; // keep the old value
    onCommit(next);
  };

  const common = {
    id,
    value: shown,
    placeholder,
    onFocus: () => setDraft(value),
    onBlur: commit,
  };

  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {multiline ? (
        <Textarea {...common} rows={3} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <Input
          {...common}
          type={type}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setDraft(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      )}
    </div>
  );
}
