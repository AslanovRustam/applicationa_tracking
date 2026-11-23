'use server';

import { signOut } from '@/auth';
import { isAuthDisabled } from '@/lib/server/auth-guard';

export async function signOutAction() {
  if (isAuthDisabled()) return;
  await signOut({ redirectTo: '/login' });
}
