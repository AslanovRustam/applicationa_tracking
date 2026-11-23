// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApplicationForm } from './ApplicationForm';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('prefills the Kyiv date of the moment the form is opened, not when it was mounted', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-23T18:00:00Z')); // 20:00 Kyiv, 23rd
  const onSubmit = vi.fn(async () => true);
  const { rerender } = render(<ApplicationForm open={false} onOpenChange={() => {}} onSubmit={onSubmit} />);

  vi.setSystemTime(new Date('2026-11-23T22:30:00Z')); // 00:30 Kyiv, 24th
  rerender(<ApplicationForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

  const date = document.querySelector<HTMLInputElement>('#f-date');
  expect(date?.value).toBe('2026-11-24');
});
