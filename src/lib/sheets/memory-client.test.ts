import { describe, expect, it } from 'vitest';
import { NotFoundError } from './client';
import { createMemorySheetsClient } from './memory-client';

describe('memory sheets client', () => {
  it('appends and reads rows', async () => {
    const c = createMemorySheetsClient();
    await c.append('vault_sections', [['s1', 'Ссылки', '0']]);
    const data = await c.batchRead(['vault_sections', 'vault_items']);
    expect(data.vault_sections).toEqual([['s1', 'Ссылки', '0']]);
    expect(data.vault_items).toEqual([]);
  });

  it('updates several rows by id', async () => {
    const c = createMemorySheetsClient({ vault_sections: [['a', 'A', '0'], ['b', 'B', '1']] });
    await c.updateRows('vault_sections', [['a', 'A2', '0'], ['b', 'B2', '1']]);
    expect((await c.batchRead(['vault_sections'])).vault_sections).toEqual([['a', 'A2', '0'], ['b', 'B2', '1']]);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const c = createMemorySheetsClient({ vault_sections: [['a', 'A', '0']] });
    await expect(c.updateRows('vault_sections', [['x', 'X', '0']])).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes by ids and ignores missing ones', async () => {
    const c = createMemorySheetsClient({ vault_sections: [['a', 'A', '0'], ['b', 'B', '1'], ['c', 'C', '2']] });
    await c.deleteByIds('vault_sections', ['b', 'x']);
    expect((await c.batchRead(['vault_sections'])).vault_sections.map((r) => r[0])).toEqual(['a', 'c']);
  });

  it('finds rows by id regardless of row order', async () => {
    const c = createMemorySheetsClient({ vault_sections: [['c', 'C', '2'], ['a', 'A', '0'], ['b', 'B', '1']] });
    await c.updateRows('vault_sections', [['a', 'A!', '0']]);
    expect((await c.batchRead(['vault_sections'])).vault_sections).toEqual([
      ['c', 'C', '2'],
      ['a', 'A!', '0'],
      ['b', 'B', '1'],
    ]);
  });

  it('returns copies so callers cannot mutate storage', async () => {
    const c = createMemorySheetsClient({ vault_sections: [['a', 'A', '0']] });
    const data = await c.batchRead(['vault_sections']);
    data.vault_sections[0][1] = 'hacked';
    expect((await c.batchRead(['vault_sections'])).vault_sections[0][1]).toBe('A');
  });
});
