import { expect, it } from 'vitest';
import { sheetsScopes } from '../../src/lib/sheets/google-client';
import { isMissingTabError } from './errors';

it('recognizes a missing tab error from the Sheets API', () => {
  expect(isMissingTabError({ code: 400, message: "Unable to parse range: 'applications'!A2:O" })).toBe(true);
});

it('does not treat permission, quota or network errors as a missing tab', () => {
  expect(isMissingTabError({ code: 403, message: 'The caller does not have permission' })).toBe(false);
  expect(isMissingTabError({ code: 429, message: 'Quota exceeded' })).toBe(false);
  expect(isMissingTabError(new TypeError('fetch failed'))).toBe(false);
});

it('uses a read-only scope for read-only clients', () => {
  expect(sheetsScopes(true)).toEqual(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  expect(sheetsScopes(false)).toEqual(['https://www.googleapis.com/auth/spreadsheets']);
});
