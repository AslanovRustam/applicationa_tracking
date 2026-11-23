import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { AllData } from '@/lib/repo/repo';
import { getRepo } from './repo-instance';
import { hasUser } from './require-user';

/** Per-request data load for pages. Always dynamic, never prerendered. */
export async function loadPageData(): Promise<AllData> {
  await connection();
  if (!(await hasUser())) redirect('/login');
  return (await getRepo()).loadAll();
}
