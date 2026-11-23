import type { Application } from './types';

export const APP_VARIABLES: Record<string, keyof Application> = {
  компания: 'company',
  должность: 'position',
  ссылка: 'url',
  контакт: 'contact',
};

const VARIABLE_RE = /\{([^{}\s]+)\}/g;

export function extractVariables(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(VARIABLE_RE)) seen.add(m[1]);
  return [...seen];
}

function resolve(name: string, app: Application | null, extra: Record<string, string>): string | null {
  const fromExtra = extra[name]?.trim();
  if (fromExtra) return extra[name];
  const field = APP_VARIABLES[name];
  if (field && app) {
    const value = String(app[field] ?? '').trim();
    if (value) return value;
  }
  return null;
}

export function fillTemplate(
  text: string,
  app: Application | null,
  extra: Record<string, string>,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  for (const name of extractVariables(text)) {
    if (resolve(name, app, extra) === null) missing.push(name);
  }
  const filled = text.replace(VARIABLE_RE, (whole, name: string) => resolve(name, app, extra) ?? whole);
  return { text: filled, missing };
}
