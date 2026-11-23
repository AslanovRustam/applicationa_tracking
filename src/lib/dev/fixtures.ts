import { addDays, nowInKyiv, todayInKyiv } from '@/lib/domain/time';
import type { Application, HistoryEntry, VaultItem, VaultSection } from '@/lib/domain/types';
import { applicationToRow, historyToRow, itemToRow, sectionToRow, type TabName } from '@/lib/sheets/schema';

/** Realistic demo data for SHEETS_DRIVER=memory, with dates relative to `now`. */
export function buildFixtures(now: Date): Partial<Record<TabName, string[][]>> {
  const today = todayInKyiv(now);
  const d = (days: number) => addDays(today, days);
  const tomorrowAt = `${d(1)}T14:00`;
  const created = (date: string) => `${date}T09:00:00.000Z`;

  const base = (id: string, appliedAt: string, company: string, position: string, url: string, source: Application['source']): Application => ({
    id,
    appliedAt,
    company,
    position,
    url,
    source,
    status: 'sent',
    interviewStage: null,
    nextEventAt: null,
    salaryAsked: '',
    salaryListed: '',
    contact: '',
    notes: '',
    createdAt: created(appliedAt),
    updatedAt: created(appliedAt),
  });

  const apps: Application[] = [
    { ...base('f1', d(-60), 'patrianna', 'Senior Frontend Engineer', 'https://jobs.ashbyhq.com/patrianna/9b9d5d7', 'ashby'), status: 'interview', interviewStage: 1, salaryAsked: '3000' },
    { ...base('f2', d(-55), 'GR8_TECH', 'Senior Front End Developer', 'https://djinni.co/jobs/838834-senior-front-end-developer/', 'djinni'), status: 'rejected', salaryAsked: '3000', salaryListed: '4000–6000' },
    { ...base('f3', d(-55), 'Amplitude', 'Staff Software Engineer - UI Foundations', 'https://job-boards.greenhouse.io/amplitude/jobs/8709', 'greenhouse'), status: 'rejected' },
    { ...base('f4', d(-54), 'HCLTech', 'React Developer', 'https://www.linkedin.com/jobs/view/react-developer-at-hcltech', 'linkedin') },
    { ...base('f5', d(-40), 'Akvelon', 'Frontend Developer', 'https://jobs.dou.ua/companies/akvelon/vacancies/1/', 'dou'), status: 'screening', nextEventAt: tomorrowAt, contact: 'Анна, HR' },
    { ...base('f6', d(-10), 'Devox Software', 'React/Next.js Software Engineer | Contractor', 'https://jobs.dou.ua/companies/devox-software/vacancies/2/', 'dou') },
    { ...base('f7', d(-6), 'Anadea', 'Senior Frontend Developer (React, Next.js)', 'https://jobs.dou.ua/companies/anadea/vacancies/3/', 'dou'), salaryAsked: '3000' },
    { ...base('f8', d(-5), 'Boosta', 'Middle Front End Developer (React)', 'https://jobs.dou.ua/companies/boosta/vacancies/4/', 'dou') },
    { ...base('f9', d(-3), 'GITMIR', 'Front-end розробник', 'https://robota.ua/company15877647/vacancy10794416', 'robota'), salaryAsked: '120 000 — 200 000' },
    { ...base('f10', d(-2), 'WiX', 'Frontend Engineer', 'https://jobs.dou.ua/companies/wix/vacancies/369562/', 'dou') },
    { ...base('f11', d(-1), 'Hirexio', 'Senior Frontend Engineer', 'https://djinni.co/jobs/842705-senior-frontend-engineer/', 'djinni'), salaryAsked: '2500', salaryListed: '4000-6000' },
    { ...base('f12', d(0), 'n-ix', 'Senior Frontend Engineer (Design System)', 'https://careers.n-ix.com/jobs/4510049101', 'company_site') },
  ];

  const history: HistoryEntry[] = apps.map((a) => ({
    id: `h-${a.id}`,
    applicationId: a.id,
    status: 'sent',
    interviewStage: null,
    at: a.appliedAt,
    note: '',
  }));
  history.push(
    { id: 'h-f1-s', applicationId: 'f1', status: 'screening', interviewStage: null, at: d(-50), note: 'HR-звонок' },
    { id: 'h-f1-i', applicationId: 'f1', status: 'interview', interviewStage: 1, at: d(-45), note: '' },
    { id: 'h-f2-r', applicationId: 'f2', status: 'rejected', interviewStage: null, at: d(-30), note: '' },
    { id: 'h-f3-r', applicationId: 'f3', status: 'rejected', interviewStage: null, at: d(-40), note: 'изменили требования к вакансии' },
    { id: 'h-f5-s', applicationId: 'f5', status: 'screening', interviewStage: null, at: nowInKyiv(now), note: '' },
  );

  const sections: VaultSection[] = [
    { id: 'sec-links', name: 'Ссылки', order: 0 },
    { id: 'sec-templates', name: 'Шаблоны', order: 1 },
  ];
  const items: VaultItem[] = [
    { id: 'it1', sectionId: 'sec-links', type: 'link', title: 'Резюме EN', content: 'https://example.com/cv-en.pdf', tags: ['EN'], order: 0 },
    { id: 'it2', sectionId: 'sec-links', type: 'link', title: 'LinkedIn', content: 'https://www.linkedin.com/in/example', tags: [], order: 1 },
    { id: 'it3', sectionId: 'sec-links', type: 'link', title: 'GitHub', content: 'https://github.com/example', tags: [], order: 2 },
    {
      id: 'it4',
      sectionId: 'sec-templates',
      type: 'text',
      title: 'Сопроводительное — короткое',
      content:
        "Hi {контакт}! I'm excited about the {должность} role at {компания}. I'm a frontend developer with 5+ years of experience in React, Next.js and TypeScript. I'd be happy to talk in more detail.",
      tags: ['EN', 'cover'],
      order: 0,
    },
    {
      id: 'it5',
      sectionId: 'sec-templates',
      type: 'text',
      title: 'Ответ рекрутеру',
      content: 'Thanks for reaching out! I am open to new opportunities. Could you share more details about the {должность} position?',
      tags: ['EN'],
      order: 1,
    },
  ];

  return {
    applications: apps.map(applicationToRow),
    history: history.map(historyToRow),
    vault_sections: sections.map(sectionToRow),
    vault_items: items.map(itemToRow),
  };
}
