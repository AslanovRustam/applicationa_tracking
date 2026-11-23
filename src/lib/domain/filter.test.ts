import { describe, expect, it } from 'vitest';
import { filterApplications, groupCounts, sortApplications, type Filters } from './filter';
import { makeApp } from './test-helpers';

const apps = [
  makeApp({ id: '1', company: 'GR8_TECH', position: 'Senior Front End Developer', status: 'rejected', source: 'djinni' }),
  makeApp({ id: '2', company: 'Devox Software', position: 'React/Next.js Engineer', status: 'sent', source: 'dou' }),
  makeApp({ id: '3', company: 'patrianna', position: 'Senior Frontend Engineer', status: 'interview', interviewStage: 1, source: 'ashby' }),
  makeApp({ id: '4', company: 'Akvelon', position: 'Frontend', status: 'screening', source: 'dou' }),
  makeApp({ id: '5', company: 'HCLTech', position: 'React Developer', status: 'ghosted', source: 'linkedin' }),
];

const base: Filters = { query: '', group: 'all', source: 'all' };
const ids = (list: { id: string }[]) => list.map((a) => a.id);

describe('filterApplications', () => {
  it('searches company case-insensitively', () => {
    expect(ids(filterApplications(apps, { ...base, query: 'gr8' }))).toEqual(['1']);
  });

  it('searches position too', () => {
    expect(ids(filterApplications(apps, { ...base, query: 'next.js' }))).toEqual(['2']);
  });

  it('filters waiting = sent only', () => {
    expect(ids(filterApplications(apps, { ...base, group: 'waiting' }))).toEqual(['2']);
  });

  it('filters active = screening, interview, offer', () => {
    expect(ids(filterApplications(apps, { ...base, group: 'active' }))).toEqual(['3', '4']);
  });

  it('filters by source', () => {
    expect(ids(filterApplications(apps, { ...base, source: 'dou' }))).toEqual(['2', '4']);
  });
});

describe('groupCounts', () => {
  it('counts each group', () => {
    expect(groupCounts(apps)).toEqual({ all: 5, waiting: 1, active: 2, rejected: 1, ghosted: 1, archived: 0 });
  });
});

describe('sortApplications', () => {
  it('sorts by date desc, breaking ties by later createdAt first', () => {
    const list = [
      makeApp({ id: 'old', appliedAt: '2026-08-12', createdAt: '2026-08-12T09:00:00.000Z' }),
      makeApp({ id: 'same-early', appliedAt: '2026-08-14', createdAt: '2026-08-14T09:00:00.000Z' }),
      makeApp({ id: 'same-late', appliedAt: '2026-08-14', createdAt: '2026-08-14T18:00:00.000Z' }),
    ];
    expect(ids(sortApplications(list, 'appliedAt', 'desc'))).toEqual(['same-late', 'same-early', 'old']);
  });

  it('sorts by company asc ignoring case', () => {
    expect(ids(sortApplications(apps, 'company', 'asc'))).toEqual(['4', '2', '1', '5', '3']);
  });

  it('does not mutate the input', () => {
    const copy = [...apps];
    sortApplications(apps, 'company', 'asc');
    expect(apps).toEqual(copy);
  });
});

describe('archived group', () => {
  const withArchived = [...apps, makeApp({ id: '6', company: 'Old', status: 'archived' })];

  it('filters archived only', () => {
    expect(ids(filterApplications(withArchived, { ...base, group: 'archived' }))).toEqual(['6']);
  });

  it('does not count archived as active', () => {
    expect(ids(filterApplications(withArchived, { ...base, group: 'active' }))).toEqual(['3', '4']);
  });

  it('counts archived', () => {
    expect(groupCounts(withArchived).archived).toBe(1);
  });
});
