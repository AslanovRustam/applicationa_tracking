/**
 * One-off migration from the old Google Sheet tab into the app's new spreadsheet.
 * The old spreadsheet is only read. Usage:
 *   npm run migrate -- --dry-run   # report only, writes nothing
 *   npm run migrate                # write (skips rows that already exist)
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { Application, HistoryEntry, Status } from '../../src/lib/domain/types';
import { createRepo } from '../../src/lib/repo/repo';
import { resolveCredentialsJson } from '../../src/lib/sheets/credentials';
import { createGoogleSheetsClient } from '../../src/lib/sheets/google-client';
import { applicationFromRow, applicationToRow, historyToRow, parseRows } from '../../src/lib/sheets/schema';
import { dedupeKey } from './dedupe';
import { isMissingTabError } from './errors';
import { isImportable, parseLegacyRow, parseLegacyVault, type ParsedLegacy } from './parse-legacy';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const dryRun = process.argv.includes('--dry-run');

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Не задана переменная ${name} (см. README → «Перенос старых откликов»)`);
    process.exit(1);
  }
  return v;
}

let credentialsJson: string;
try {
  credentialsJson = resolveCredentialsJson(process.env, (p) => readFileSync(p, 'utf8'));
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const oldId = need('OLD_SPREADSHEET_ID');
const newId = need('SPREADSHEET_ID');
const oldTab = process.env.OLD_SHEET_TAB || 'отклики';

if (oldId === newId) {
  console.error('OLD_SPREADSHEET_ID и SPREADSHEET_ID совпадают — приложение должно работать с НОВОЙ таблицей.');
  process.exit(1);
}

const chunk = <T>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

async function main() {
  const oldClient = createGoogleSheetsClient({ spreadsheetId: oldId, credentialsJson, readOnly: true });
  const newClient = createGoogleSheetsClient({ spreadsheetId: newId, credentialsJson });

  const raw = await oldClient.readRange(`'${oldTab.replace(/'/g, "''")}'!A1:I`);
  if (!raw.length) throw new Error(`Вкладка «${oldTab}» пуста или не найдена`);
  const [header, ...rows] = raw;
  const cell = (r: string[], i: number) => r[i] ?? '';

  const parsed: { rowNumber: number; p: ParsedLegacy }[] = [];
  const skipped: string[] = [];
  let fallback: string | undefined;
  rows.forEach((r, i) => {
    const rowNumber = i + 2;
    const p = parseLegacyRow(
      {
        rowNumber,
        date: cell(r, 0),
        company: cell(r, 1),
        link: cell(r, 2),
        position: cell(r, 3),
        salary: cell(r, 4),
        s1: cell(r, 5),
        s2: cell(r, 6),
        s3: cell(r, 7),
      },
      fallback,
    );
    if (!p) return;
    if (p.application.appliedAt) fallback = p.application.appliedAt;
    if (isImportable(p)) parsed.push({ rowNumber, p });
    else skipped.push(`  строка ${rowNumber}: нет компании и должности, пропущена (ссылка: ${p.application.url || '—'})`);
  });
  const vault = parseLegacyVault(cell(header, 8), rows.map((r) => cell(r, 8)));

  // Existing records in the new sheet (empty if the tabs don't exist yet)
  let existing = new Set<string>();
  try {
    const d = await newClient.batchRead(['applications']);
    existing = new Set(parseRows(d.applications, applicationFromRow, 'applications').map(dedupeKey));
  } catch (e) {
    // Only a missing tab means "nothing imported yet"; anything else would silently disable dedupe.
    if (!isMissingTabError(e)) throw e;
    existing = new Set();
  }
  const fresh = parsed.filter(({ p }) => !existing.has(dedupeKey(p.application)));

  // ---- report
  const byStatus = new Map<Status, number>();
  for (const { p } of parsed) byStatus.set(p.application.status, (byStatus.get(p.application.status) ?? 0) + 1);
  console.log(`\nСтарая вкладка «${oldTab}»: ${parsed.length} откликов`);
  console.log('По статусам:', Object.fromEntries(byStatus));
  console.log(`Уже есть в новой таблице (пропускаются): ${parsed.length - fresh.length}`);
  console.log(`Будет перенесено: ${fresh.length}`);
  const reviews = parsed.filter(({ p }) => p.review.length);
  console.log(`\nНа ручную проверку: ${reviews.length}`);
  for (const { rowNumber, p } of reviews) {
    console.log(`  строка ${rowNumber} (${p.application.company || '—'}): ${p.review.join('; ')}`);
  }
  if (skipped.length) console.log(`\nПропущено строк: ${skipped.length}\n${skipped.join('\n')}`);
  console.log(`\nВ Копилку: ${vault.texts.length} текстов → «Шаблоны», ${vault.links.length} ссылок → «Ссылки»`);

  if (dryRun) {
    console.log('\n--dry-run: ничего не записано.');
    return;
  }

  // ---- write
  await newClient.ensureTabs();
  const apps: Application[] = [];
  const history: HistoryEntry[] = [];
  for (const { rowNumber, p } of fresh) {
    const id = randomUUID();
    const base = Date.parse(`${p.application.appliedAt || '2000-01-01'}T09:00:00Z`) + rowNumber * 1000;
    const createdAt = new Date(base).toISOString();
    apps.push({ id, ...p.application, createdAt, updatedAt: createdAt });
    for (const h of p.history) history.push({ id: randomUUID(), applicationId: id, ...h });
  }
  for (const part of chunk(apps, 100)) await newClient.append('applications', part.map(applicationToRow));
  for (const part of chunk(history, 100)) await newClient.append('history', part.map(historyToRow));
  console.log(`\nЗаписано: ${apps.length} откликов, ${history.length} записей истории.`);

  const repo = createRepo(newClient);
  const all = await repo.loadAll();
  const sectionId = async (name: string) =>
    all.sections.find((s) => s.name === name)?.id ?? (await repo.createSection(name)).id;
  const known = new Set(all.items.map((i) => i.content.trim()));
  let added = 0;
  if (vault.links.length) {
    const sid = await sectionId('Ссылки');
    for (const l of vault.links) {
      if (known.has(l.url)) continue;
      await repo.createItem({ sectionId: sid, type: 'link', title: l.title, content: l.url, tags: [] });
      added++;
    }
  }
  if (vault.texts.length) {
    const sid = await sectionId('Шаблоны');
    for (const t of vault.texts) {
      if (known.has(t.content.trim())) continue;
      await repo.createItem({ sectionId: sid, type: 'text', title: t.title, content: t.content, tags: ['из таблицы'] });
      added++;
    }
  }
  console.log(`Копилка: добавлено ${added} записей.`);
}

main().catch((e) => {
  console.error('\nОшибка переноса:', e instanceof Error ? e.message : e);
  process.exit(1);
});
