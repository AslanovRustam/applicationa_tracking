// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const clipboard = vi.hoisted(() => ({ copyText: vi.fn(async () => true) }));
vi.mock('@/lib/clipboard', () => clipboard);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useCopyTemplate } from './use-copy-template';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Harness() {
  const { copyTemplate, dialog } = useCopyTemplate();
  return (
    <>
      <button type="button" onClick={() => copyTemplate('Привет, {имя}!', null)}>
        start
      </button>
      {dialog}
    </>
  );
}

it('does not copy while a variable is left blank', () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('start'));
  fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }));
  expect(clipboard.copyText).not.toHaveBeenCalled();
});

it('copies once every variable is filled', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('start'));
  fireEvent.change(screen.getByLabelText('{имя}'), { target: { value: 'Анна' } });
  fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }));
  await vi.waitFor(() => expect(clipboard.copyText).toHaveBeenCalledWith('Привет, Анна!'));
});
