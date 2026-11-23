import { describe, expect, it } from 'vitest';
import { detectSource, extractFirstUrl } from './source';

describe('detectSource', () => {
  it.each([
    ['https://jobs.dou.ua/companies/swivl/vacancies/185966/', 'dou'],
    ['https://djinni.co/jobs/842452-reactjs-developer/', 'djinni'],
    ['https://www.linkedin.com/jobs/view/4426054455/', 'linkedin'],
    ['https://lnkd.in/abc', 'linkedin'],
    ['https://robota.ua/company15877647/vacancy10794416', 'robota'],
    ['https://www.work.ua/jobs/123/', 'workua'],
    ['https://nofluffjobs.com/pl/job/x', 'nofluffjobs'],
    ['https://www.arbeitnow.co.uk/view/x', 'arbeitnow'],
    ['https://arbeitnow.fr/x', 'arbeitnow'],
    ['https://himalayas.app/companies/x/jobs/y', 'himalayas'],
    ['https://job-boards.eu.greenhouse.io/x/jobs/1', 'greenhouse'],
    ['https://jobs.ashbyhq.com/patrianna/9b9d', 'ashby'],
    ['https://jobs.lever.co/x/1', 'lever'],
    ['https://jobs.smartrecruiters.com/x/1', 'smartrecruiters'],
    ['https://jobs.dover.com/x', 'dover'],
    ['https://www.devart.com/vacancies/frontend-developer.html', 'company_site'],
    ['', 'other'],
    ['не ссылка', 'other'],
  ])('detectSource(%s) = %s', (url, expected) => {
    expect(detectSource(url)).toBe(expected);
  });

  it('does not treat a lookalike host as a known board', () => {
    expect(detectSource('https://notdou.ua/x')).toBe('company_site');
  });
});

describe('extractFirstUrl', () => {
  it('takes the first link from a cell with two links and extra text', () => {
    expect(extractFirstUrl(' см. https://lnkd.in/x и https://linkedin.com/jobs/1 ')).toBe('https://lnkd.in/x');
    expect(detectSource('https://jobs.dou.ua/x https://comeet.com/y')).toBe('dou');
  });

  it('returns null when there is no link', () => {
    expect(extractFirstUrl('просто текст')).toBeNull();
  });
});
