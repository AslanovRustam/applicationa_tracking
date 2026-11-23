// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeApp } from '@/lib/domain/test-helpers';
import type { VaultItem } from '@/lib/domain/types';
import { TextItemCard } from './TextItemCard';

afterEach(cleanup);

const item: VaultItem = { id: 'i', sectionId: 's', type: 'text', title: 'Cover', content: 'Role at {компания}', tags: [], order: 0 };
const a = makeApp({ id: 'a', company: 'Alpha' });
const b = makeApp({ id: 'b', company: 'Beta' });
const noop = () => {};

function card(defaultApplicationId: string, onCopy = vi.fn()) {
  return (
    <TextItemCard
      item={item}
      applications={[b, a]}
      defaultApplicationId={defaultApplicationId}
      onCopy={onCopy}
      onEdit={noop}
      onUp={noop}
      onDown={noop}
      onDelete={noop}
    />
  );
}

describe('TextItemCard application picker', () => {
  it('follows the latest application when the default changes', () => {
    const onCopy = vi.fn();
    const { rerender } = render(card('a', onCopy));
    rerender(card('b', onCopy));
    fireEvent.click(screen.getByRole('button', { name: /Копировать/ }));
    expect(onCopy).toHaveBeenCalledWith(item.content, b);
  });

  it('keeps an explicit choice', () => {
    const onCopy = vi.fn();
    const { rerender } = render(card('a', onCopy));
    fireEvent.change(screen.getByLabelText('Для какого отклика'), { target: { value: 'a' } });
    rerender(card('b', onCopy));
    fireEvent.click(screen.getByRole('button', { name: /Копировать/ }));
    expect(onCopy).toHaveBeenCalledWith(item.content, a);
  });
});
