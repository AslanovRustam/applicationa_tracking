// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultItem, VaultSection } from '@/lib/domain/types';

const actions = vi.hoisted(() => ({
  createItemAction: vi.fn(),
  createSectionAction: vi.fn(),
  deleteItemAction: vi.fn(),
  deleteSectionAction: vi.fn(),
  renameSectionAction: vi.fn(),
  reorderItemsAction: vi.fn(),
  reorderSectionsAction: vi.fn(),
  updateItemAction: vi.fn(),
}));
vi.mock('@/app/actions', () => actions);
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { useVaultState } from './use-vault-state';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const section: VaultSection = { id: 's1', name: 'Ссылки', order: 0 };
const item: VaultItem = { id: 'i1', sectionId: 's1', type: 'link', title: 'GitHub', content: 'https://github.com/x', tags: [], order: 0 };

beforeEach(() => vi.clearAllMocks());

describe('useVaultState', () => {
  it('rolls back when the request itself fails', async () => {
    actions.createItemAction.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useVaultState({ sections: [section], items: [] }));
    await act(async () => {
      await result.current.createItem({ sectionId: 's1', type: 'text', title: 'T', content: 'c', tags: [] });
    });
    expect(result.current.items).toEqual([]);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('sends a client id for new items and sections', async () => {
    actions.createItemAction.mockImplementation(async (input) => ({ ok: true, data: { ...input, order: 0 } }));
    actions.createSectionAction.mockImplementation(async (name, id) => ({ ok: true, data: { id, name, order: 1 } }));
    const { result } = renderHook(() => useVaultState({ sections: [section], items: [] }));
    await act(async () => {
      await result.current.createItem({ sectionId: 's1', type: 'text', title: 'T', content: 'c', tags: [] });
      await result.current.createSection('FAQ');
    });
    expect(actions.createItemAction.mock.calls[0][0].id).toBeTruthy();
    expect(actions.createSectionAction.mock.calls[0][1]).toBeTruthy();
    expect(result.current.items[0].id).toBe(actions.createItemAction.mock.calls[0][0].id);
  });

  it('does not resurrect an earlier failed change when a later one fails', async () => {
    const dRename = deferred<unknown>();
    const dUpdate = deferred<unknown>();
    actions.renameSectionAction.mockReturnValueOnce(dRename.promise);
    actions.updateItemAction.mockReturnValueOnce(dUpdate.promise);
    const { result } = renderHook(() => useVaultState({ sections: [section], items: [item] }));
    let p1!: Promise<boolean>;
    let p2!: Promise<boolean>;
    act(() => {
      p1 = result.current.renameSection('s1', 'Мои ссылки');
    });
    act(() => {
      p2 = result.current.updateItem('i1', { title: 'GH' });
    });
    await act(async () => {
      dRename.resolve({ ok: false, error: 'x' });
      await p1;
    });
    await act(async () => {
      dUpdate.resolve({ ok: false, error: 'x' });
      await p2;
    });
    expect(result.current.sections[0].name).toBe('Ссылки');
    expect(result.current.items[0].title).toBe('GitHub');
  });
});

describe('reordering links', () => {
  const l = (id: string, order: number): VaultItem => ({ ...item, id, title: id, order });
  const text: VaultItem = { ...item, id: 't', type: 'text', title: 'T', order: 1 };

  it('drop puts the dragged link at the target and saves the section order', async () => {
    actions.reorderItemsAction.mockResolvedValue({ ok: true, data: [] });
    const { result } = renderHook(() => useVaultState({ sections: [section], items: [l('a', 0), text, l('b', 2), l('c', 3)] }));
    await act(async () => {
      await result.current.dropItem('c', 'a');
    });
    expect(actions.reorderItemsAction).toHaveBeenCalledWith('s1', ['c', 'a', 'b', 't']);
    expect(result.current.items.filter((i) => i.type === 'link').map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('moving a link skips a text neighbour', async () => {
    actions.reorderItemsAction.mockResolvedValue({ ok: true, data: [] });
    const { result } = renderHook(() => useVaultState({ sections: [section], items: [l('a', 0), text, l('b', 2)] }));
    await act(async () => {
      await result.current.moveItem('b', -1);
    });
    expect(actions.reorderItemsAction).toHaveBeenCalledWith('s1', ['b', 'a', 't']);
  });
});
