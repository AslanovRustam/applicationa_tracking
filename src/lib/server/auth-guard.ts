export function isAuthDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUTH_DISABLED === 'true' && env.NODE_ENV !== 'production';
}

export function isAllowedEmail(
  email: string | null | undefined,
  emailVerified: boolean,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const allowed = (env.ALLOWED_EMAIL ?? '').trim().toLowerCase();
  if (!allowed || !email || !emailVerified) return false;
  return email.trim().toLowerCase() === allowed;
}
