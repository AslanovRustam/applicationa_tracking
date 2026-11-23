import type { TabName } from './schema';

export interface SheetsClient {
  /** Creates missing tabs and their header rows. */
  ensureTabs(): Promise<void>;
  /** Rows without the header, all tabs in one request. */
  batchRead(tabs: TabName[]): Promise<Record<TabName, string[][]>>;
  append(tab: TabName, rows: string[][]): Promise<void>;
  /** Finds each row by rows[i][0] (id) and overwrites it; one request. Throws NotFoundError if an id is missing. */
  updateRows(tab: TabName, rows: string[][]): Promise<void>;
  /** Deletes rows with these ids in one request; unknown ids are ignored. */
  deleteByIds(tab: TabName, ids: string[]): Promise<void>;
  /** Raw read (formatted values) of an A1 range, used by migration. */
  readRange(range: string): Promise<string[][]>;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
