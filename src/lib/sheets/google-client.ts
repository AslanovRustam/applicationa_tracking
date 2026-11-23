import { auth as gauth, sheets as sheetsApi } from '@googleapis/sheets';
import { NotFoundError, type SheetsClient } from './client';
import { withRetry } from './retry';
import { TAB_HEADERS, TAB_NAMES, type TabName } from './schema';

const colLetter = (n: number) => String.fromCharCode('A'.charCodeAt(0) + n - 1);
const lastCol = (tab: TabName) => colLetter(TAB_HEADERS[tab].length);
const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

const asStrings = (values: unknown[][] | null | undefined): string[][] =>
  (values ?? []).map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))));

export function sheetsScopes(readOnly: boolean): string[] {
  return [`https://www.googleapis.com/auth/spreadsheets${readOnly ? '.readonly' : ''}`];
}

export function createGoogleSheetsClient(opts: {
  spreadsheetId: string;
  credentialsJson: string;
  /** Read-only OAuth scope: any write attempt is rejected by Google. */
  readOnly?: boolean;
}): SheetsClient {
  const credentials = JSON.parse(opts.credentialsJson);
  const authClient = new gauth.GoogleAuth({
    credentials,
    scopes: sheetsScopes(opts.readOnly ?? false),
  });
  const api = sheetsApi({ version: 'v4', auth: authClient });
  const spreadsheetId = opts.spreadsheetId;

  async function idRows(tab: TabName): Promise<Map<string, number>> {
    const res = await withRetry(() => api.spreadsheets.values.get({ spreadsheetId, range: `${q(tab)}!A:A` }));
    const map = new Map<string, number>();
    asStrings(res.data.values).forEach((r, i) => {
      if (i > 0 && r[0]) map.set(r[0], i + 1); // 1-based row number; skip header
    });
    return map;
  }

  async function sheetIds(): Promise<Map<string, number>> {
    const res = await withRetry(() =>
      api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' }),
    );
    const map = new Map<string, number>();
    for (const s of res.data.sheets ?? []) {
      if (s.properties?.title != null && s.properties.sheetId != null) map.set(s.properties.title, s.properties.sheetId);
    }
    return map;
  }

  return {
    async ensureTabs() {
      const existing = await sheetIds();
      const missing = TAB_NAMES.filter((t) => !existing.has(t));
      if (missing.length) {
        await withRetry(() =>
          api.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) },
          }),
        );
      }
      const heads = await withRetry(() =>
        api.spreadsheets.values.batchGet({ spreadsheetId, ranges: TAB_NAMES.map((t) => `${q(t)}!1:1`) }),
      );
      const data = TAB_NAMES.flatMap((t, i) =>
        (heads.data.valueRanges?.[i]?.values?.[0]?.length ?? 0) === 0
          ? [{ range: `${q(t)}!A1`, values: [TAB_HEADERS[t]] }]
          : [],
      );
      if (data.length) {
        await withRetry(() =>
          api.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data } }),
        );
      }
    },

    async batchRead(tabs) {
      const res = await withRetry(() =>
        api.spreadsheets.values.batchGet({
          spreadsheetId,
          ranges: tabs.map((t) => `${q(t)}!A2:${lastCol(t)}`),
          valueRenderOption: 'FORMATTED_VALUE',
        }),
      );
      const out = {} as Record<TabName, string[][]>;
      for (const t of TAB_NAMES) out[t] = [];
      tabs.forEach((t, i) => {
        out[t] = asStrings(res.data.valueRanges?.[i]?.values as unknown[][] | undefined);
      });
      return out;
    },

    async append(tab, rows) {
      if (!rows.length) return;
      await withRetry(
        () =>
          api.spreadsheets.values.append({
          spreadsheetId,
          range: `${q(tab)}!A1`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: rows },
        }),
        { only429: true },
      );
    },

    async updateRows(tab, rows) {
      if (!rows.length) return;
      const ids = await idRows(tab);
      const data = rows.map((row) => {
        const n = ids.get(row[0]);
        if (!n) throw new NotFoundError(`No row with id "${row[0]}" in "${tab}"`);
        return { range: `${q(tab)}!A${n}:${lastCol(tab)}${n}`, values: [row] };
      });
      await withRetry(() =>
        api.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data } }),
      );
    },

    async deleteByIds(tab, idsToDelete) {
      if (!idsToDelete.length) return;
      const [ids, sheets] = await Promise.all([idRows(tab), sheetIds()]);
      const sheetId = sheets.get(tab);
      if (sheetId === undefined) return;
      const rowNumbers = idsToDelete
        .map((id) => ids.get(id))
        .filter((n): n is number => n !== undefined)
        .sort((a, b) => b - a);
      if (!rowNumbers.length) return;
      await withRetry(() =>
        api.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: rowNumbers.map((n) => ({
              deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: n - 1, endIndex: n } },
            })),
          },
        }),
      );
    },

    async readRange(range) {
      const res = await withRetry(() =>
        api.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: 'FORMATTED_VALUE' }),
      );
      return asStrings(res.data.values as unknown[][] | undefined);
    },
  };
}
