import type { Source } from './types';

export const SOURCE_LABELS: Record<Source, string> = {
  dou: 'DOU',
  djinni: 'Djinni',
  linkedin: 'LinkedIn',
  robota: 'robota.ua',
  workua: 'work.ua',
  nofluffjobs: 'No Fluff Jobs',
  arbeitnow: 'Arbeitnow',
  himalayas: 'Himalayas',
  greenhouse: 'Greenhouse',
  ashby: 'Ashby',
  lever: 'Lever',
  smartrecruiters: 'SmartRecruiters',
  dover: 'Dover',
  company_site: 'Сайт компании',
  other: 'Другое',
};

const HOST_SOURCES: [string, Source][] = [
  ['dou.ua', 'dou'],
  ['djinni.co', 'djinni'],
  ['linkedin.com', 'linkedin'],
  ['lnkd.in', 'linkedin'],
  ['robota.ua', 'robota'],
  ['work.ua', 'workua'],
  ['nofluffjobs.com', 'nofluffjobs'],
  ['himalayas.app', 'himalayas'],
  ['greenhouse.io', 'greenhouse'],
  ['ashbyhq.com', 'ashby'],
  ['lever.co', 'lever'],
  ['smartrecruiters.com', 'smartrecruiters'],
  ['dover.com', 'dover'],
];

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

export function detectSource(urlOrText: string): Source {
  const raw = extractFirstUrl(urlOrText);
  if (!raw) return 'other';
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  for (const [domain, source] of HOST_SOURCES) {
    if (host === domain || host.endsWith('.' + domain)) return source;
  }
  if (/(^|\.)arbeitnow\.[a-z.]+$/.test(host)) return 'arbeitnow';
  return 'company_site';
}
