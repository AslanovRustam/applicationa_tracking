import { expect, it } from 'vitest';
import { dedupeKey } from './dedupe';

it('normalizes case, spaces and trailing slash', () => {
  expect(dedupeKey({ company: ' GR8_TECH ', url: 'https://djinni.co/jobs/1/', appliedAt: '2026-08-14' })).toBe(
    dedupeKey({ company: 'gr8_tech', url: 'https://djinni.co/jobs/1', appliedAt: '2026-08-14' }),
  );
});

it('differs by date', () => {
  expect(dedupeKey({ company: 'A', url: 'u', appliedAt: '2026-08-14' })).not.toBe(
    dedupeKey({ company: 'A', url: 'u', appliedAt: '2026-08-15' }),
  );
});
