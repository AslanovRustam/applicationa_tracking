import 'server-only';
import { auth } from '@/auth';
import { isAuthDisabled } from './auth-guard';

export class UnauthorizedError extends Error {
  constructor() {
    super('Не авторизован');
    this.name = 'UnauthorizedError';
  }
}

/** Returns true if the current request is allowed. */
export async function hasUser(): Promise<boolean> {
  if (isAuthDisabled()) return true;
  const session = await auth();
  return Boolean(session?.user);
}

export async function requireUser(): Promise<void> {
  if (!(await hasUser())) throw new UnauthorizedError();
}
