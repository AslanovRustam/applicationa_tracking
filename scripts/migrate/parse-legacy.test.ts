import { describe, expect, it } from 'vitest';
import { parseLegacyDayMonth, parseLegacyRow, parseLegacyVault, type LegacyRow } from './parse-legacy';

describe('parseLegacyDayMonth', () => {
  it.each([
    ['реджект 02,09', '2026-08-11', '2026-09-02'],
    ['реджект 1109-изменили требования к вакансии', '2026-08-14', '2026-09-11'],
    ['звкрыли вакансию 30.10', '2026-10-19', '2026-10-30'],
    ['13.10', '2026-10-13', '2026-10-13'],
    ['9.11 получил письмо с анкетой и вопросами на почту, заполнил 12.11', '2026-11-09', '2026-11-09'],
    ['реджект 05,01', '2026-12-20', '2027-01-05'],
    ['закрыли вакансию, дали ссылку для мониторинга вакансий', '2026-11-03', null],
  ])('parseLegacyDayMonth(%s, %s) = %s', (text, appliedAt, expected) => {
    expect(parseLegacyDayMonth(text, appliedAt)).toBe(expected);
  });

  it('ignores impossible dates', () => {
    expect(parseLegacyDayMonth('реджект 45,13', '2026-08-11')).toBeNull();
  });
});

const row = (overrides: Partial<LegacyRow>): LegacyRow => ({
  rowNumber: 2,
  date: '11.08.2026',
  company: 'patrianna',
  link: 'https://jobs.ashbyhq.com/patrianna/9b9d',
  position: 'Senior Frontend Engineer',
  salary: '',
  s1: '',
  s2: '',
  s3: '',
  ...overrides,
});

describe('parseLegacyRow', () => {
  it('parses a standard rejection', () => {
    const p = parseLegacyRow(row({ s1: 'реджект 02,09' }))!;
    expect(p.application).toMatchObject({ appliedAt: '2026-08-11', source: 'ashby', status: 'rejected', interviewStage: null });
    expect(p.history.map((h) => [h.status, h.at])).toEqual([
      ['sent', '2026-08-11'],
      ['rejected', '2026-09-02'],
    ]);
    expect(p.review).toEqual([]);
  });

  it('keeps the rejection reason as a history note', () => {
    const p = parseLegacyRow(row({ date: '14.08.2026', s1: 'реджект 1109-изменили требования к вакансии' }))!;
    expect(p.history[1]).toMatchObject({ status: 'rejected', at: '2026-09-11', note: 'изменили требования к вакансии' });
  });

  it('treats a closed position as rejected', () => {
    const p = parseLegacyRow(row({ date: '25.08.2026', s1: 'позиция уже закрыта 27,10' }))!;
    expect(p.history[1]).toMatchObject({ status: 'rejected', at: '2026-10-27', note: 'вакансия закрыта' });
  });

  it('dates a closed position without a date by the application date; URL in s2 goes to notes', () => {
    const p = parseLegacyRow(
      row({ date: '03.11.2026', s1: 'закрыли вакансию, дали ссылку для мониторинга вакансий', s2: 'https://example.com/careers' }),
    )!;
    expect(p.history).toHaveLength(2);
    expect(p.history[1].status).toBe('rejected');
    expect(p.history[1].at).toBe('2026-11-03');
    expect(p.history[1].note.startsWith('вакансия закрыта')).toBe(true);
    expect(p.application.notes).toContain('https://example.com/careers');
  });

  it('parses two interview stages (Akvelon)', () => {
    const p = parseLegacyRow(row({ date: '13.10.2026', company: 'Akvelon', s1: '13.10', s2: '16,10 техническое' }))!;
    expect(p.history.map((h) => [h.status, h.interviewStage, h.at, h.note])).toEqual([
      ['sent', null, '2026-10-13', ''],
      ['interview', 1, '2026-10-13', ''],
      ['interview', 2, '2026-10-16', 'техническое'],
    ]);
    expect(p.application).toMatchObject({ status: 'interview', interviewStage: 2 });
  });

  it('treats other text with a date as screening', () => {
    const text = '09,09 написали что в течении 2-ух недель дадут фидбек';
    const p = parseLegacyRow(row({ date: '07.09.2026', s1: text }))!;
    expect(p.history[1]).toMatchObject({ status: 'screening', at: '2026-09-09', note: text });
    expect(p.application.status).toBe('screening');
  });

  it('uses the first link and keeps the full cell in notes', () => {
    const p = parseLegacyRow(row({ link: 'https://jobs.dou.ua/x https://comeet.com/y' }))!;
    expect(p.application.url).toBe('https://jobs.dou.ua/x');
    expect(p.application.source).toBe('dou');
    expect(p.application.notes).toContain('https://comeet.com/y');
  });

  it('flags a URL in the company column for review but still imports', () => {
    const p = parseLegacyRow(row({ company: 'https://careers.n-ix.com/jobs/1' }))!;
    expect(p.review.length).toBeGreaterThan(0);
    expect(p.application.company).toBe('https://careers.n-ix.com/jobs/1');
  });

  it('keeps salary text verbatim', () => {
    const p = parseLegacyRow(row({ salary: '2500(в вакансии указано 4000-6000)' }))!;
    expect(p.application.salaryAsked).toBe('2500(в вакансии указано 4000-6000)');
    expect(p.application.salaryListed).toBe('');
  });

  it('parses an old year', () => {
    expect(parseLegacyRow(row({ date: '02.07.2024' }))!.application.appliedAt).toBe('2024-07-02');
  });

  it('flags unknown text without a date and treats it as screening on the application date', () => {
    const p = parseLegacyRow(row({ s1: 'что-то странное' }))!;
    expect(p.history[1]).toMatchObject({ status: 'screening', at: '2026-08-11', note: 'что-то странное' });
    expect(p.review.length).toBeGreaterThan(0);
  });

  it('flags a bad application date', () => {
    const p = parseLegacyRow(row({ date: 'вчера' }))!;
    expect(p.review.length).toBeGreaterThan(0);
  });

  it('returns null for an empty row', () => {
    expect(parseLegacyRow(row({ date: '', company: '', link: '', position: '' }))).toBeNull();
  });

  it('sent-only row stays sent', () => {
    const p = parseLegacyRow(row({}))!;
    expect(p.application.status).toBe('sent');
    expect(p.history).toHaveLength(1);
  });
});

describe('parseLegacyVault', () => {
  it('splits texts and links', () => {
    const v = parseLegacyVault('Hello, my name is Rustam.\nAs a front-end developer…', [
      'Привіт, мене звати Рустам.\nЯк фронтенд-розробник…',
      'https://drive.google.com/file/d/x',
      'Hi, i would like to put myself forward…',
      '',
    ]);
    expect(v.texts).toHaveLength(3);
    expect(v.texts[0].title).toBe('Hello, my name is Rustam.');
    expect(v.texts[0].content).toContain('front-end developer');
    expect(v.links).toEqual([{ title: 'drive.google.com', url: 'https://drive.google.com/file/d/x' }]);
  });

  it('cuts long titles to 40 characters', () => {
    const v = parseLegacyVault('', ['A'.repeat(100)]);
    expect(v.texts[0].title).toHaveLength(40);
  });
});
