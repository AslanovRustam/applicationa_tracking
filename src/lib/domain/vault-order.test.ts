import { describe, expect, it } from 'vitest';
import { sectionOrderAfterDrop, sectionOrderAfterMove } from './vault-order';
import type { VaultItem } from './types';

const item = (id: string, type: VaultItem['type'], order: number, sectionId = 's1'): VaultItem => ({
  id,
  sectionId,
  type,
  title: id,
  content: id,
  tags: [],
  order,
});

// links a, b and text t are mixed in one section; another section's item must be ignored
const items = [item('a', 'link', 0), item('t', 'text', 1), item('b', 'link', 2), item('x', 'link', 0, 's2')];

describe('sectionOrderAfterMove', () => {
  it('swaps with the previous item of the same type, skipping other types', () => {
    expect(sectionOrderAfterMove(items, 'b', -1)).toEqual(['b', 'a', 't']);
  });

  it('swaps with the next item of the same type', () => {
    expect(sectionOrderAfterMove(items, 'a', 1)).toEqual(['b', 'a', 't']);
  });

  it('returns null at the edges', () => {
    expect(sectionOrderAfterMove(items, 'a', -1)).toBeNull();
    expect(sectionOrderAfterMove(items, 't', 1)).toBeNull();
  });
});

describe('sectionOrderAfterDrop', () => {
  const many = [item('a', 'link', 0), item('b', 'link', 1), item('c', 'link', 2), item('t', 'text', 3)];

  it('moves the dragged link to the drop target position', () => {
    expect(sectionOrderAfterDrop(many, 'c', 'a')).toEqual(['c', 'a', 'b', 't']);
    expect(sectionOrderAfterDrop(many, 'a', 'c')).toEqual(['b', 'c', 'a', 't']);
  });

  it('ignores drops on itself, across types or across sections', () => {
    expect(sectionOrderAfterDrop(many, 'a', 'a')).toBeNull();
    expect(sectionOrderAfterDrop(many, 'a', 't')).toBeNull();
    expect(sectionOrderAfterDrop([...many, item('x', 'link', 0, 's2')], 'a', 'x')).toBeNull();
  });
});
