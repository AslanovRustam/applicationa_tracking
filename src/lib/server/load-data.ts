import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { AllData } from '@/lib/repo/repo';
import { getRepo } from './repo-instance';
import { hasUser } from './require-user';

export const DEFAULT_SECTIONS = ['Ссылки', 'Шаблоны'];

/** Per-request data load for pages. Always dynamic, never prerendered. */
export async function loadPageData(): Promise<AllData> {
  await connection();
  if (!(await hasUser())) redirect('/login');
  return (await getRepo()).loadAll();
}

/** Like loadPageData, but creates the starter sections the first time the vault is opened. */
export async function loadVaultData(): Promise<AllData> {
  const data = await loadPageData();
  if (data.sections.length > 0) return data;
  const repo = await getRepo();
  for (const name of DEFAULT_SECTIONS) await repo.createSection(name);
  return repo.loadAll();
}
