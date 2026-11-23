import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { hasUser } from '@/lib/server/require-user';

export const metadata = { title: 'Вход — Отклики' };

type SearchParams = Promise<{ error?: string }>;

async function LoginStatus({ searchParams }: { searchParams: SearchParams }) {
  if (await hasUser()) redirect('/');
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error === 'AccessDenied' ? 'Этот Google-аккаунт не допущен.' : 'Не удалось войти. Попробуйте ещё раз.'}
    </p>
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Трекер откликов</h1>
        <p className="mt-2 text-sm text-muted-foreground">Личное приложение. Вход только для владельца.</p>
        <Suspense fallback={null}>
          <LoginStatus searchParams={searchParams} />
        </Suspense>
        <form
          className="mt-6"
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/' });
          }}
        >
          <Button type="submit" className="w-full">
            Войти через Google
          </Button>
        </form>
      </div>
    </main>
  );
}
