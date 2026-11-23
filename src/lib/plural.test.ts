import { expect, it } from 'vitest';
import { plural } from './plural';

const forms: [string, string, string] = ['запись', 'записи', 'записей'];

it.each([
  [1, 'запись'],
  [2, 'записи'],
  [5, 'записей'],
  [11, 'записей'],
  [12, 'записей'],
  [21, 'запись'],
  [22, 'записи'],
  [111, 'записей'],
])('plural(%i) = %s', (n, expected) => {
  expect(plural(n, forms)).toBe(expected);
});
