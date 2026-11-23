'use client';

import { LogOutIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/auth-actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Отклики' },
  { href: '/vault', label: 'Копилка' },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-1 px-3 sm:px-6">
        <span className="mr-3 font-semibold">🎯</span>
        <nav className="flex gap-1">
          {LINKS.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOutAction} className="ml-auto">
          <Button type="submit" variant="ghost" size="sm" aria-label="Выйти">
            <LogOutIcon />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
