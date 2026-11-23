import { NotFoundError, type SheetsClient } from './client';
import { TAB_NAMES, type TabName } from './schema';

const copy = (rows: string[][]) => rows.map((r) => [...r]);

export function createMemorySheetsClient(seed: Partial<Record<TabName, string[][]>> = {}): SheetsClient {
  const store = {} as Record<TabName, string[][]>;
  for (const t of TAB_NAMES) store[t] = copy(seed[t] ?? []);

  return {
    async ensureTabs() {},

    async batchRead(tabs) {
      const out = {} as Record<TabName, string[][]>;
      for (const t of TAB_NAMES) out[t] = tabs.includes(t) ? copy(store[t]) : [];
      return out;
    },

    async append(tab, rows) {
      store[tab].push(...copy(rows));
    },

    async updateRows(tab, rows) {
      const indexes = rows.map((row) => {
        const i = store[tab].findIndex((r) => r[0] === row[0]);
        if (i === -1) throw new NotFoundError(`No row with id "${row[0]}" in "${tab}"`);
        return i;
      });
      rows.forEach((row, k) => {
        store[tab][indexes[k]] = [...row];
      });
    },

    async deleteByIds(tab, ids) {
      const set = new Set(ids);
      store[tab] = store[tab].filter((r) => !set.has(r[0]));
    },

    async readRange() {
      return [];
    },
  };
}
