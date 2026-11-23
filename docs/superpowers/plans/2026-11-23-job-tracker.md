# Трекер откликов — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Личное веб-приложение на Vercel. В нём трекер откликов (сводка + таблица + доска активных) и «Копилка» шаблонов и ссылок с подстановкой переменных. Данные хранятся в Google-таблице пользователя.

**Architecture:** Next.js App Router. Вся работа с Google Sheets идёт только на сервере, через интерфейс `SheetsClient`; у него две реализации: Google API и in-memory для тестов и локальной разработки. Над клиентом стоит репозиторий `Repo`, над репозиторием — Server Actions. Страница загружает все данные одним `batchGet`, клиентские компоненты держат состояние у себя и обновляют его оптимистично. Вся логика (статусы, сводка, фильтры, шаблоны, разбор старой таблицы) — чистые функции с тестами в `src/lib/domain` и `scripts/migrate`.

**Tech Stack:** Next.js (последняя стабильная, TypeScript, App Router, `src/`), Tailwind CSS + shadcn/ui (Sheet, Dialog, AlertDialog, DropdownMenu, Select, Badge, Sonner), Auth.js (`next-auth` v5, провайдер Google), `googleapis`, `zod`, `@dnd-kit/core`, Vitest, `tsx` для скриптов.

**Spec:** `docs/superpowers/specs/2026-11-23-job-tracker-design.md`

## Global Constraints

- Интерфейс на русском языке.
- Часовой пояс для «сегодня», «за 7 дней» и `next_event_at` — `Europe/Kyiv` (серверы Vercel работают в UTC).
- Вкладки таблицы и заголовки колонок — ровно `applications`, `history`, `vault_sections`, `vault_items` с колонками из спеки; `id` — всегда колонка A.
- Строки ищутся только по `id`, никогда по номеру строки. Запись — `valueInputOption: "RAW"`, даты строками ISO (`2026-08-14`, `2026-09-02T14:00`).
- Пускаем только Google-аккаунт с email из `ALLOWED_EMAIL`. Сессия JWT, `maxAge` 90 дней.
- Никаких `alert/confirm/prompt` браузера: подтверждения делаются через shadcn `AlertDialog`.
- Переменные окружения: `GOOGLE_SERVICE_ACCOUNT_JSON`, `SPREADSHEET_ID`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `ALLOWED_EMAIL`; для локальной разработки `SHEETS_DRIVER=memory`, `AUTH_DISABLED=true`; для переноса `OLD_SPREADSHEET_ID`, `OLD_SHEET_TAB`.
- Без кэша между запросами: каждая загрузка страницы делает один `batchGet` *(отступление от «кэш + revalidateTag» в спеке: на Vercel несколько инстансов, кэш в памяти отдавал бы устаревшие данные; один запрос на сотни строк — это 0,3–1 с, приемлемо)*.
- Не делаем: аналитику, Ctrl+K, офлайн, уведомления, разбор страницы вакансии.

## Review Focus

1. **Полночь по Киеву.** В 00:30 по Киеву (22:30 UTC накануне) новый отклик должен получить сегодняшнюю киевскую дату, а не вчерашнюю дату по UTC. → тест в Task 2.
2. **Таблицу поправили руками.** Строка без `id` или с неизвестным статусом пропускается и пишется в лог, страница при этом открывается. → тест в Task 4.
3. **Сохранение не удалось** (429 или сеть). Запись не исчезает молча: после ретраев пользователь видит ошибку и кнопку «Повторить», оптимистичное изменение откатывается. → тест ретраев в Task 5, проверка UI в Task 8.
4. **Пустое поле в отклике для переменной.** Если `{контакт}` пуст, переменная считается незаполненной и пользователя просят её ввести. В тексте не должно появиться «undefined» или пустое место. → тест в Task 3.
5. **Чужой Google-аккаунт / `AUTH_DISABLED` в продакшене.** Вход для чужого email отклоняется, а `AUTH_DISABLED=true` при `NODE_ENV=production` игнорируется. → тест в Task 7.

---

### Task 1: Каркас проекта, типы и определение источника

**Files:**
- Create: проект через `npx create-next-app@latest . --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm`
- Create: `.gitignore` (дополнить строками `.superpowers/`, `.env*.local`), `.env.example`, `vitest.config.ts`
- Create: `src/lib/domain/types.ts`, `src/lib/domain/source.ts`
- Test: `src/lib/domain/source.test.ts`

**Interfaces:**
- Produces (`types.ts`):
```ts
export type Status = 'sent' | 'screening' | 'interview' | 'offer' | 'rejected' | 'ghosted';
export type Source = 'dou' | 'djinni' | 'linkedin' | 'robota' | 'workua' | 'nofluffjobs' | 'arbeitnow'
  | 'himalayas' | 'greenhouse' | 'ashby' | 'lever' | 'smartrecruiters' | 'dover' | 'company_site' | 'other';
export interface Application {
  id: string; appliedAt: string /* YYYY-MM-DD */; company: string; position: string; url: string;
  source: Source; status: Status; interviewStage: number | null; nextEventAt: string | null /* YYYY-MM-DDTHH:mm, Киев */;
  salaryAsked: string; salaryListed: string; contact: string; notes: string;
  createdAt: string; updatedAt: string /* ISO UTC */;
}
export interface HistoryEntry { id: string; applicationId: string; status: Status; interviewStage: number | null; at: string /* YYYY-MM-DD или YYYY-MM-DDTHH:mm */; note: string }
export interface VaultSection { id: string; name: string; order: number }
export type VaultItemType = 'link' | 'text';
export interface VaultItem { id: string; sectionId: string; type: VaultItemType; title: string; content: string; tags: string[]; order: number }
```
- Produces (`source.ts`): `extractFirstUrl(text: string): string | null`, `detectSource(urlOrText: string): Source`, `SOURCE_LABELS: Record<Source, string>`.

- [ ] **Step 1:** `git init`, создать проект через create-next-app, `npx shadcn@latest init` (базовый цвет neutral), `npm i -D vitest vite-tsconfig-paths tsx`, `npm i zod`. В `package.json` добавить `"test": "vitest run"`. `vitest.config.ts` — `environment: 'node'`, плагин `vite-tsconfig-paths`. В `.env.example` перечислить все переменные из Global Constraints.
- [ ] **Step 2: Написать падающий тест** `source.test.ts`:
```ts
it.each([
  ['https://jobs.dou.ua/companies/swivl/vacancies/185966/', 'dou'],
  ['https://djinni.co/jobs/842452-reactjs-developer/', 'djinni'],
  ['https://www.linkedin.com/jobs/view/4426054455/', 'linkedin'],
  ['https://lnkd.in/abc', 'linkedin'],
  ['https://robota.ua/company15877647/vacancy10794416', 'robota'],
  ['https://www.work.ua/jobs/123/', 'workua'],
  ['https://nofluffjobs.com/pl/job/x', 'nofluffjobs'],
  ['https://www.arbeitnow.co.uk/view/x', 'arbeitnow'],
  ['https://arbeitnow.fr/x', 'arbeitnow'],
  ['https://himalayas.app/companies/x/jobs/y', 'himalayas'],
  ['https://job-boards.eu.greenhouse.io/x/jobs/1', 'greenhouse'],
  ['https://jobs.ashbyhq.com/patrianna/9b9d', 'ashby'],
  ['https://jobs.lever.co/x/1', 'lever'],
  ['https://jobs.smartrecruiters.com/x/1', 'smartrecruiters'],
  ['https://jobs.dover.com/x', 'dover'],
  ['https://www.devart.com/vacancies/frontend-developer.html', 'company_site'],
  ['', 'other'],
  ['не ссылка', 'other'],
])('detectSource(%s) = %s', (url, expected) => expect(detectSource(url)).toBe(expected));
it('берёт первую ссылку из ячейки с двумя ссылками и мусором', () => {
  expect(extractFirstUrl(' см. https://lnkd.in/x и https://linkedin.com/jobs/1 ')).toBe('https://lnkd.in/x');
  expect(detectSource('https://jobs.dou.ua/x https://comeet.com/y')).toBe('dou');
});
```
- [ ] **Step 3:** `npm test` → FAIL (модуля нет).
- [ ] **Step 4:** Реализовать `source.ts`: таблица «суффикс хоста → Source» (совпадение по `host === d || host.endsWith('.' + d)`; для arbeitnow — любой хост вида `arbeitnow.*`); валидный URL без совпадения → `company_site`; пусто или невалидно → `other`. `SOURCE_LABELS` — человеческие названия («DOU», «Djinni», «LinkedIn», «robota.ua», «work.ua», …, «Сайт компании», «Другое»).
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → успешно.
- [ ] **Step 6: Commit** (вместе со спекой и этим планом):
```bash
git add -A && git commit -m "chore: scaffold Next.js app, domain types, source detection"
```

### Task 2: Статусы, время по Киеву, сводка, фильтры

**Files:**
- Create: `src/lib/domain/time.ts`, `src/lib/domain/status.ts`, `src/lib/domain/summary.ts`, `src/lib/domain/filter.ts`
- Test: `src/lib/domain/time.test.ts`, `status.test.ts`, `summary.test.ts`, `filter.test.ts`

**Interfaces:**
- Consumes: типы из Task 1.
- Produces:
```ts
// time.ts
export const TZ = 'Europe/Kyiv';
export function todayInKyiv(now: Date): string;            // 'YYYY-MM-DD'
export function nowInKyiv(now: Date): string;              // 'YYYY-MM-DDTHH:mm'
export function addDays(date: string, days: number): string;
export function formatShortDate(date: string): string;     // '14.08'
// status.ts
export const STATUS_LABELS: Record<Status, string>;        // Отправлен, Скрининг, Собеседование, Оффер, Отказ, Тишина
export function statusBadgeLabel(a: Pick<Application,'status'|'interviewStage'>): string; // 'Собес 2' для interview
export const ACTIVE_STATUSES: Status[];                    // ['screening','interview','offer']
export const STALE_DAYS = 30;
export function isStale(a: Application, today: string): boolean;
export function nextInterviewStage(appHistory: HistoryEntry[]): number;
// summary.ts
export interface Summary { lastWeek: number; total: number; inProgress: number; nextEvent: { applicationId: string; company: string; at: string } | null }
export function computeSummary(apps: Application[], now: Date): Summary;
// filter.ts
export type StatusGroup = 'all' | 'waiting' | 'active' | 'rejected' | 'ghosted';
export interface Filters { query: string; group: StatusGroup; source: Source | 'all' }
export type SortKey = 'appliedAt' | 'company' | 'status';
export function filterApplications(apps: Application[], f: Filters): Application[];
export function sortApplications(apps: Application[], key: SortKey, dir: 'asc' | 'desc'): Application[];
export function groupCounts(apps: Application[]): Record<StatusGroup, number>;
```

- [ ] **Step 1: Написать падающие тесты:**
  - `todayInKyiv(new Date('2026-08-13T22:30:00Z')) === '2026-08-14'` (Review Focus 1); `nowInKyiv(new Date('2026-08-13T22:30:00Z')) === '2026-08-14T01:30'`; `addDays('2026-12-30', 3) === '2027-01-02'`.
  - `isStale`: `sent` с `appliedAt` = today−30 → `true`; today−29 → `false`; `rejected` с today−90 → `false`.
  - `nextInterviewStage([])` → 1; при записях истории `interview` с этапами 1 и 2 → 3.
  - `statusBadgeLabel({status:'interview', interviewStage:2})` → `'Собес 2'`.
  - `computeSummary`, now = `2026-11-23T10:00Z`: отклики с `appliedAt` 2026-11-17…2026-11-23 входят в `lastWeek`, 2026-11-16 — нет; `inProgress` считает только `ACTIVE_STATUSES`; `nextEvent` — ближайший `nextEventAt` не раньше `nowInKyiv(now)` среди не-`rejected`/`ghosted`, прошедшие события игнорируются.
  - `filterApplications`: `query: 'gr8'` находит `GR8_TECH` (регистр не важен, поиск по company + position); `group: 'waiting'` → только `sent`; `group: 'active'` → `ACTIVE_STATUSES`; `source` фильтрует по источнику.
  - `sortApplications` по `appliedAt desc`: при равных датах выше тот, у кого позже `createdAt`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реализовать. Даты — через `Intl.DateTimeFormat('en-CA', { timeZone: TZ, … })`, без сторонних библиотек. `isStale` = `status === 'sent' && appliedAt <= addDays(today, -STALE_DAYS)` (`sent` — начальный статус, его дата и есть `appliedAt`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: status, time, summary and filter domain logic`.

### Task 3: Переменные в шаблонах

**Files:**
- Create: `src/lib/domain/template.ts`
- Test: `src/lib/domain/template.test.ts`

**Interfaces:**
- Produces:
```ts
export const APP_VARIABLES: Record<string, keyof Application>; // { 'компания':'company', 'должность':'position', 'ссылка':'url', 'контакт':'contact' }
export function extractVariables(text: string): string[];       // уникальные, в порядке появления
export function fillTemplate(text: string, app: Application | null, extra: Record<string, string>):
  { text: string; missing: string[] };
```

- [ ] **Step 1: Написать падающие тесты:**
  - `extractVariables('Hi {имя}, {должность} at {компания}, {компания}')` → `['имя','должность','компания']`; `'{ не переменная }'` и `'{}'` → `[]`.
  - `fillTemplate('{должность} at {компания}', app{position:'Senior Front End Developer', company:'GR8_TECH'}, {})` → `{ text: 'Senior Front End Developer at GR8_TECH', missing: [] }`.
  - Review Focus 4: `app.contact === ''`, текст `'Привет, {контакт}!'` → `missing: ['контакт']`, а в `text` остаётся `'{контакт}'` (не `''` и не `'undefined'`); с `extra: { 'контакт': 'Анна' }` → `'Привет, Анна!'`.
  - `app === null` → все переменные из `APP_VARIABLES` в `missing`.
  - Неизвестная переменная `{имя}` берётся из `extra`, иначе попадает в `missing`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реализовать: регулярка `/\{([^{}\s]+)\}/g`; приоритет: `extra` → поле отклика (непустое после `trim`) → missing.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: template variable substitution`.

### Task 4: Схема таблицы и преобразование строк

**Files:**
- Create: `src/lib/sheets/schema.ts`
- Test: `src/lib/sheets/schema.test.ts`

**Interfaces:**
- Produces:
```ts
export type TabName = 'applications' | 'history' | 'vault_sections' | 'vault_items';
export const TAB_HEADERS: Record<TabName, string[]>;
// applications: id, applied_at, company, position, url, source, status, interview_stage, next_event_at,
//               salary_asked, salary_listed, contact, notes, created_at, updated_at
// history: id, application_id, status, interview_stage, at, note
// vault_sections: id, name, order
// vault_items: id, section_id, type, title, content, tags, order
export function applicationFromRow(row: string[]): Application | null;
export function applicationToRow(a: Application): string[];
export function historyFromRow(row: string[]): HistoryEntry | null;
export function historyToRow(h: HistoryEntry): string[];
export function sectionFromRow(row: string[]): VaultSection | null;
export function sectionToRow(s: VaultSection): string[];
export function itemFromRow(row: string[]): VaultItem | null;
export function itemToRow(i: VaultItem): string[];
export function parseRows<T>(rows: string[][], fromRow: (r: string[]) => T | null, tab: TabName): T[]; // пропускает null + console.warn с номером строки
```

- [ ] **Step 1: Написать падающие тесты:**
  - Круговое преобразование: `applicationFromRow(applicationToRow(a))` равно `a` — для полного объекта и для объекта с `interviewStage: null`, `nextEventAt: null`.
  - Хвостовые пустые ячейки, которые Google обрезает (строка короче заголовков), читаются как `''`/`null`.
  - Review Focus 2: строка без `id` → `null`; `status: 'реджект'` → `null`; `source: 'unknown'` → `'other'` (не отбрасываем запись из-за источника); `parseRows` с одной битой строкой среди трёх возвращает две и вызывает `console.warn` один раз.
  - `itemToRow` пишет `tags` как `'EN, cover'`, `itemFromRow` читает обратно `['EN','cover']`; пустая строка → `[]`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реализовать на `zod`: схема по объекту, собранному из заголовков; числа (`interview_stage`, `order`) парсятся из строк.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: sheet schema and row mapping`.

### Task 5: SheetsClient — Google и in-memory

**Files:**
- Create: `src/lib/sheets/client.ts` (интерфейс + `NotFoundError`), `src/lib/sheets/memory-client.ts`, `src/lib/sheets/google-client.ts`, `src/lib/sheets/retry.ts`
- Test: `src/lib/sheets/memory-client.test.ts`, `src/lib/sheets/retry.test.ts`

**Interfaces:**
- Consumes: `TabName`, `TAB_HEADERS` (Task 4).
- Produces:
```ts
export interface SheetsClient {
  ensureTabs(): Promise<void>;                                        // создаёт недостающие вкладки и строку заголовков
  batchRead(tabs: TabName[]): Promise<Record<TabName, string[][]>>;   // без строки заголовков, один запрос
  append(tab: TabName, rows: string[][]): Promise<void>;
  updateRows(tab: TabName, rows: string[][]): Promise<void>;          // ищет по rows[i][0] (id); один запрос; NotFoundError если id нет
  deleteByIds(tab: TabName, ids: string[]): Promise<void>;            // один batchUpdate, индексы по убыванию; отсутствующие id игнорируются
  readRange(range: string): Promise<string[][]>;                      // сырое чтение (FORMATTED_VALUE) — для переноса
}
export class NotFoundError extends Error {}
export function createMemorySheetsClient(seed?: Partial<Record<TabName, string[][]>>): SheetsClient;
export function createGoogleSheetsClient(opts: { spreadsheetId: string; credentialsJson: string }): SheetsClient;
export async function withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number; baseMs?: number }): Promise<T>; // по умолчанию 3 и 500 мс
```

- [ ] **Step 1: Написать падающие тесты:**
  - memory: `append` → `batchRead` возвращает строку; `updateRows` двух строк меняет обе; `updateRows` с неизвестным id → `NotFoundError`; `deleteByIds(['b','x'])` удаляет `b` и не падает на `x`; после ручной «сортировки» seed (строки в другом порядке) `updateRows` всё равно меняет нужную строку.
  - `withRetry` (с фейковыми таймерами): ошибка `{ code: 429 }` дважды, потом успех → результат, 3 вызова; ошибка 500 четыре раза → бросает последнюю ошибку после 4 вызовов; ошибка 400 → бросает сразу, 1 вызов (Review Focus 3).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реализовать memory-клиент и `withRetry` (повтор на 429 и 5xx, задержка `baseMs * 2^попытка`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Реализовать `google-client.ts` на `googleapis` (`npm i googleapis`), JWT-аутентификация из `credentialsJson`, scope `https://www.googleapis.com/auth/spreadsheets`. Каждый вызов API обёрнут в `withRetry`. `updateRows`: прочитать колонку `A` вкладки → построить карту id→номер строки → `values.batchUpdate` с RAW. `deleteByIds`: `spreadsheets.get` (числовой `sheetId`) + колонка A → `batchUpdate` с `deleteDimension` по убыванию. `ensureTabs`: `spreadsheets.get` → `addSheet` для отсутствующих + запись заголовков, если строка 1 пустая. Юнит-тестов нет (проверяется в Task 14 на реальной таблице); `npx tsc --noEmit` проходит.
- [ ] **Step 6: Commit** `feat: sheets client (google + memory) with retry`.

### Task 6: Репозиторий

**Files:**
- Create: `src/lib/repo/repo.ts`, `src/lib/repo/inputs.ts`
- Test: `src/lib/repo/repo.test.ts`

**Interfaces:**
- Consumes: `SheetsClient` (Task 5), функции схемы (Task 4), `detectSource`, `extractFirstUrl` (Task 1), `todayInKyiv` (Task 2).
- Produces:
```ts
// inputs.ts (zod-схемы и типы)
export interface NewApplicationInput { company: string; position: string; url: string; appliedAt?: string; source?: Source;
  salaryAsked?: string; salaryListed?: string; contact?: string; notes?: string }
export type ApplicationPatch = Partial<Pick<Application, 'appliedAt'|'company'|'position'|'url'|'source'|'nextEventAt'|'salaryAsked'|'salaryListed'|'contact'|'notes'>>;
export interface StatusChange { status: Status; interviewStage: number | null; at: string; note: string }
export interface NewVaultItemInput { sectionId: string; type: VaultItemType; title: string; content: string; tags: string[] }
// repo.ts
export interface AllData { applications: Application[]; history: HistoryEntry[]; sections: VaultSection[]; items: VaultItem[] }
export interface Repo {
  loadAll(): Promise<AllData>;
  createApplication(input: NewApplicationInput, now: Date): Promise<{ application: Application; history: HistoryEntry }>;
  updateApplication(id: string, patch: ApplicationPatch, now: Date): Promise<Application>;
  changeStatus(id: string, change: StatusChange, now: Date): Promise<{ application: Application; history: HistoryEntry }>;
  markGhosted(ids: string[], now: Date): Promise<{ applications: Application[]; history: HistoryEntry[] }>;
  deleteApplication(id: string): Promise<void>;
  createSection(name: string): Promise<VaultSection>;
  renameSection(id: string, name: string): Promise<VaultSection>;
  deleteSection(id: string): Promise<void>;
  reorderSections(orderedIds: string[]): Promise<VaultSection[]>;
  createItem(input: NewVaultItemInput): Promise<VaultItem>;
  updateItem(id: string, patch: Partial<Omit<VaultItem,'id'>>): Promise<VaultItem>;
  deleteItem(id: string): Promise<void>;
  reorderItems(sectionId: string, orderedIds: string[]): Promise<VaultItem[]>;
}
export function createRepo(client: SheetsClient, newId?: () => string): Repo; // newId по умолчанию crypto.randomUUID
```

- [ ] **Step 1: Написать падающие тесты** (memory-клиент, фиксированные `now` и `newId`):
  - `createApplication({company:'GR8_TECH', position:'Senior Front End Developer', url:'https://djinni.co/jobs/838834'})` при `now = 2026-08-13T22:30Z` → `appliedAt: '2026-08-14'`, `source: 'djinni'`, `status: 'sent'`, и одна запись истории `sent` на `'2026-08-14'`.
  - Пустые `company` или `position` → ошибка валидации, в таблицу ничего не записано.
  - `changeStatus(id, {status:'interview', interviewStage:2, at:'2026-10-16', note:'техническое'})` → у отклика `status`/`interviewStage`/`updatedAt` обновлены, в истории новая запись; `changeStatus` на `rejected` обнуляет `interviewStage` у отклика (в истории этап не трогаем).
  - `markGhosted([a,b])` делает один вызов `updateRows` для applications и один `append` для history (проверить шпионом).
  - `deleteApplication` удаляет и отклик, и все его записи истории.
  - `deleteSection` удаляет и записи раздела; `reorderSections(['c','a','b'])` выставляет `order` 0, 1, 2.
  - `loadAll` пропускает битые строки и возвращает остальные.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реализовать. Каждый метод: прочитать нужные вкладки (`batchRead`), найти запись, записать изменения минимальным числом вызовов клиента. Отсутствующий id → `NotFoundError`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: repository over sheets client`.

### Task 7: Вход, защита маршрутов, выбор хранилища, Server Actions

**Files:**
- Create: `src/auth.ts`, `src/lib/server/auth-guard.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/login/page.tsx`
- Create: `src/middleware.ts` (или `src/proxy.ts`, если установленная версия Next использует новую конвенцию)
- Create: `src/lib/server/repo-instance.ts`, `src/lib/dev/fixtures.ts`, `src/app/actions.ts`
- Test: `src/lib/server/auth-guard.test.ts`

**Interfaces:**
- Consumes: `createRepo` (Task 6), клиенты (Task 5).
- Produces:
```ts
// auth-guard.ts
export function isAuthDisabled(env?: NodeJS.ProcessEnv): boolean;     // true только если AUTH_DISABLED==='true' && NODE_ENV!=='production'
export function isAllowedEmail(email: string | null | undefined, emailVerified: boolean, env?: NodeJS.ProcessEnv): boolean;
export async function requireUser(): Promise<void>;                    // бросает, если нет сессии (и вход не отключён)
// repo-instance.ts
export function getRepo(): Repo;  // SHEETS_DRIVER=memory → memory-клиент из fixtures (один на процесс, через globalThis); иначе google; ensureTabs() один раз на инстанс
// actions.ts — 'use server'; каждый экшен: requireUser() → repo → { ok: true, data } | { ok: false, error: string }
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
// createApplicationAction, updateApplicationAction, changeStatusAction, markGhostedAction, deleteApplicationAction,
// createSectionAction, renameSectionAction, deleteSectionAction, reorderSectionsAction,
// createItemAction, updateItemAction, deleteItemAction, reorderItemsAction — аргументы как у соответствующих методов Repo, без now (берётся new Date())
```

- [ ] **Step 1: Написать падающие тесты** (Review Focus 5):
  - `isAuthDisabled({AUTH_DISABLED:'true', NODE_ENV:'production'})` → `false`; `{AUTH_DISABLED:'true', NODE_ENV:'development'}` → `true`; без переменной → `false`.
  - `isAllowedEmail('Me@Gmail.com', true, {ALLOWED_EMAIL:'me@gmail.com'})` → `true`; другой email → `false`; `emailVerified: false` → `false`; пустой `ALLOWED_EMAIL` → `false`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реализовать `auth-guard.ts`. `npm i next-auth@5` (beta, если стабильной v5 нет). `src/auth.ts`: провайдер Google, `session: { strategy: 'jwt', maxAge: 60*60*24*90 }`, колбэк `signIn` → `isAllowedEmail(profile.email, profile.email_verified)`, `pages.signIn: '/login'`. Middleware/proxy пропускает `/login`, `/api/auth/*`, статику и манифест; остальное без сессии → редирект на `/login` (если `!isAuthDisabled()`). `/login` — по центру кнопка «Войти через Google» и текст ошибки при отказе.
- [ ] **Step 4:** `fixtures.ts`: ~12 откликов на основе реальных строк (patrianna — `interview`, этап 1; GR8_TECH и Amplitude — `rejected`; Devox и HCLTech — `sent`, причём HCLTech старше 30 дней; один `screening` с `nextEventAt` на завтра), история к ним, разделы «Ссылки» и «Шаблоны», 3 ссылки и 2 текста — в одном `{компания}`, `{должность}` и `{контакт}`. Реализовать `repo-instance.ts` и `actions.ts`.
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → успешно.
- [ ] **Step 6: Commit** `feat: auth, route protection, server actions`.

### Task 8: Трекер — каркас, сводка, панель, таблица, добавление

**Files:**
- Create: `src/app/(app)/layout.tsx` (верхняя навигация: «Отклики» `/`, «Копилка» `/vault`, меню пользователя с «Выйти»)
- Create: `src/app/(app)/page.tsx` (серверный: `getRepo().loadAll()` → `<TrackerApp initial={…} />`)
- Create: `src/components/tracker/TrackerApp.tsx` (клиентский контейнер состояния), `SummaryCards.tsx`, `Toolbar.tsx`, `ApplicationsTable.tsx`, `ApplicationsList.tsx` (мобильные карточки), `StatusBadge.tsx`, `ApplicationForm.tsx`
- Create: `src/components/tracker/use-tracker-state.ts`

**Interfaces:**
- Consumes: всё из `src/lib/domain`, экшены (Task 7), типы `AllData`.
- Produces (`use-tracker-state.ts`), используется в Task 9–11:
```ts
export interface TrackerState {
  applications: Application[]; history: HistoryEntry[];
  create(input: NewApplicationInput): Promise<boolean>;
  update(id: string, patch: ApplicationPatch): Promise<boolean>;
  changeStatus(id: string, change: StatusChange): Promise<boolean>;
  markGhosted(ids: string[]): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}
export function useTrackerState(initial: Pick<AllData,'applications'|'history'>): TrackerState;
```
Каждый метод сначала применяет изменение локально (у нового отклика временный id `tmp-…`), потом вызывает экшен. Успех → подменить данными сервера. Ошибка → откатить и показать `toast.error('Не удалось сохранить', { action: { label: 'Повторить', onClick: <повтор того же вызова> } })`.

- [ ] **Step 1:** `npx shadcn@latest add button input badge card dialog sheet alert-dialog select dropdown-menu sonner textarea label tabs`. Подключить `<Toaster />` в корневом layout.
- [ ] **Step 2:** Реализовать `useTrackerState` и компоненты:
  - `SummaryCards` — 4 карточки из `computeSummary`: «откликов за неделю», «всего», «в процессе», «ближайшее событие» (компания + `ДД.ММ, ЧЧ:ММ`, или «—»).
  - `Toolbar` — «+ Отклик», поиск, чипсы групп со счётчиками из `groupCounts` (Все / Ждут ответа / В процессе / Отказ / Тишина), select источника, переключатель «Таблица / Доска» (`Tabs`; доска в Task 10, пока заглушка).
  - `ApplicationsTable` (≥ `md`) — колонки: Дата, Компания, Должность, Статус, Источник, ЗП; сортировка по клику на Дату/Компанию/Статус; у отклика с `isStale` рядом пометка «нет ответа 30+ дн». `ApplicationsList` (< `md`) — карточки «компания / должность / статус / дата». Клик по строке выставляет `selectedId` (панель — Task 9).
  - `ApplicationForm` (Dialog, на телефоне на весь экран) — поле «Ссылка» первым и в фокусе; после вставки ссылки `source` заполняется через `detectSource`, но его можно поменять; дата по умолчанию `todayInKyiv(new Date())`; обязательны только компания и должность; кнопки «Сохранить» и «Сохранить и добавить ещё» (вторая очищает форму, оставляет её открытой и ставит фокус в «Ссылку»). На телефоне «+ Отклик» — плавающая кнопка справа внизу.
  - Цвета плашек: sent — indigo, screening — sky, interview — amber, offer — green, rejected — red, ghosted — gray.
- [ ] **Step 3: Проверка в браузере.** `SHEETS_DRIVER=memory AUTH_DISABLED=true npm run dev`, открыть через Playwright:
  - сводка показывает числа из фикстур, у HCLTech есть пометка 30+;
  - добавление отклика с ссылкой на djinni: источник «Djinni», отклик появился вверху сразу, до ответа сервера;
  - поиск «gr8» оставляет GR8_TECH; чипс «Отказ» оставляет только отказы;
  - ширина 390px: список карточек и плавающая кнопка;
  - Review Focus 3: временно заставить `createApplicationAction` вернуть `{ok:false}` (например, пустая `company` в обход формы или временная заглушка) — отклик откатился, тост «Не удалось сохранить» с кнопкой «Повторить» показан. Заглушку убрать.
- [ ] **Step 4:** `npm run build` и `npm test` → успешно.
- [ ] **Step 5: Commit** `feat: tracker page with summary, filters, table and quick add`.

### Task 9: Карточка отклика — правка, статус, история, удаление, Тишина

**Files:**
- Create: `src/components/tracker/ApplicationDrawer.tsx`, `StatusChangeForm.tsx`, `HistoryTimeline.tsx`, `StaleBanner.tsx`
- Modify: `src/components/tracker/TrackerApp.tsx` (подключить панель и баннер)

**Interfaces:**
- Consumes: `TrackerState` (Task 8), `nextInterviewStage`, `isStale`, `nowInKyiv`.
- Produces: `ApplicationDrawer` с пропсом `actionsSlot?: React.ReactNode` — в Task 11 туда встанет кнопка «Скопировать сопроводительное».

- [ ] **Step 1:** Реализовать:
  - `ApplicationDrawer` — shadcn `Sheet` справа (≥ `md`, ширина ~420px) или на весь экран (< `md`). Поля редактируются на месте, сохранение по blur/Enter через `update`. Ссылка открывается в новой вкладке. Поле «ближайшее событие» — `datetime-local`.
  - `StatusChangeForm` — выбор статуса; для «Собеседование» номер этапа, по умолчанию `nextInterviewStage(история)`; дата/время по умолчанию `nowInKyiv(new Date())`, можно поменять; заметка; «Сохранить» → `changeStatus`.
  - `HistoryTimeline` — записи истории отклика по дате, сверху новые: дата, статус, заметка.
  - Удаление — кнопка «Удалить» → `AlertDialog` «Удалить отклик в {company}? Это нельзя отменить.» → `remove`.
  - `StaleBanner` над таблицей, если есть отклики с `isStale`: «N откликов без ответа 30+ дней» + «Отметить все как Тишина» (`AlertDialog` → `markGhosted`). В панели у такого отклика — кнопка «Отметить как Тишина».
- [ ] **Step 2: Проверка в браузере** (memory-режим): у patrianna сменить статус на «Собеседование» — по умолчанию подставился этап 2, в истории появилась запись; дату можно поставить задним числом; удаление спрашивает подтверждение через встроенное окно (не через браузерный `confirm`); «Отметить все как Тишина» переводит HCLTech в «Тишина», и баннер исчезает.
- [ ] **Step 3:** `npm run build` → успешно.
- [ ] **Step 4: Commit** `feat: application drawer with status history and ghosting`.

### Task 10: Доска активных откликов

**Files:**
- Create: `src/components/tracker/Board.tsx`, `src/lib/domain/board.ts`
- Test: `src/lib/domain/board.test.ts`
- Modify: `src/components/tracker/TrackerApp.tsx` (заменить заглушку доски)

**Interfaces:**
- Produces:
```ts
export type BoardColumn = 'screening' | 'interview' | 'offer' | 'rejected';
export function boardChangeFor(app: Application, appHistory: HistoryEntry[], target: BoardColumn, now: Date): StatusChange | null;
// null — если цель совпадает со статусом (для interview — без изменения этапа)
```

- [ ] **Step 1: Написать падающие тесты:** `screening → interview` при пустой истории собесов → `{status:'interview', interviewStage:1, at: nowInKyiv(now), note:''}`; при истории с этапом 1 → этап 2; `interview → offer` → `interviewStage: null`; перенос в ту же колонку → `null`; `→ rejected` → `{status:'rejected', interviewStage:null, …}`.
- [ ] **Step 2:** `npm test` → FAIL; реализовать `board.ts`; `npm test` → PASS.
- [ ] **Step 3:** `npm i @dnd-kit/core`. `Board`: колонки «Скрининг / Собеседование / Оффер» только с отфильтрованными активными откликами, внизу зона «Отказ». Перетаскивание → `boardChangeFor` → `changeStatus`. Клик по карточке открывает ту же панель. На телефоне колонки прокручиваются горизонтально; перетаскивание работает и пальцем (`TouchSensor` с задержкой 200 мс, чтобы не мешать прокрутке).
- [ ] **Step 4: Проверка в браузере:** перетащить screening-отклик в «Собеседование» — плашка «Собес 1», в истории запись; бросить в «Отказ» — отклик пропал с доски и виден в таблице как «Отказ».
- [ ] **Step 5: Commit** `feat: kanban board for active applications`.

### Task 11: Копилка

**Files:**
- Create: `src/app/(app)/vault/page.tsx`, `src/components/vault/VaultApp.tsx`, `use-vault-state.ts`, `SectionBlock.tsx`, `LinkChip.tsx`, `TextItemCard.tsx`, `ItemEditor.tsx`, `CopyTextButton.tsx`, `MissingVariablesDialog.tsx`, `CoverLetterPicker.tsx`
- Create: `src/lib/clipboard.ts`
- Modify: `src/components/tracker/TrackerApp.tsx` (передать `CoverLetterPicker` в `actionsSlot` панели)

**Interfaces:**
- Consumes: экшены копилки (Task 7), `fillTemplate`, `extractVariables` (Task 3), `ApplicationDrawer.actionsSlot` (Task 9).
- Produces:
```ts
export async function copyText(text: string): Promise<boolean>; // navigator.clipboard, запасной вариант — textarea + execCommand
// CopyTextButton props: { text: string; applications: Application[]; defaultApplicationId: string | null; showPicker: boolean }
// CoverLetterPicker props: { application: Application; items: VaultItem[] } // только type==='text'
```
`use-vault-state.ts` — оптимистичный хук по образцу `useTrackerState` для разделов и записей.

- [ ] **Step 1:** Реализовать страницу `/vault` (серверная загрузка через `loadAll` → `VaultApp`):
  - Сверху поиск по названию и содержимому записей и фильтр-чипсы по тегам.
  - Разделы по `order`: заголовок (переименование на месте), меню «Переименовать / Удалить» (`AlertDialog`: «Удалить раздел и N записей?»), кнопки ↑/↓ для порядка, «+ Добавить запись», внизу страницы «+ Новый раздел».
  - `LinkChip` для `link`: клик копирует URL, иконка ↗ открывает его, меню ⋯ «Изменить / Удалить / ↑ / ↓».
  - `TextItemCard` для `text`: заголовок, теги, превью в 3 строки (переменные подсвечены), `CopyTextButton`, меню ⋯ как у ссылок.
  - `CopyTextButton`: если в тексте есть переменные — select отклика рядом с кнопкой (по умолчанию последний по `createdAt`), превью показывает подставленный текст; клик → `fillTemplate`; есть `missing` → `MissingVariablesDialog` с полем на каждую переменную → копирование; иначе копирование сразу. После копирования `toast.success('Скопировано')`.
  - `ItemEditor` (Dialog): тип (ссылка/текст), заголовок, содержимое (для текста — textarea с подсказкой «Переменные: {компания} {должность} {ссылка} {контакт} или любая своя {имя}»), теги через запятую.
  - Если разделов нет — один раз создать «Ссылки» и «Шаблоны».
  - `CoverLetterPicker` в панели отклика: кнопка «Скопировать сопроводительное» → список текстовых записей → выбор → `fillTemplate` с этим откликом (недостающие переменные — тем же диалогом) → копирование.
- [ ] **Step 2: Проверка в браузере** (memory-режим): создать раздел «Ответы на частые вопросы», добавить в него текст, переименовать раздел, переставить его выше; скопировать шаблон с `{контакт}` для отклика без контакта — появляется диалог, введённое имя попало в текст (прочитать буфер через `navigator.clipboard.readText` в Playwright); «Скопировать сопроводительное» из панели GR8_TECH подставляет «GR8_TECH» и «Senior Front End Developer»; удаление раздела удаляет и его записи.
- [ ] **Step 3:** `npm run build` и `npm test` → успешно.
- [ ] **Step 4: Commit** `feat: vault page with editable sections, templates and variables`.

### Task 12: PWA и инструкция по настройке

**Files:**
- Create: `src/app/manifest.ts`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` (простая иконка: буква «О» или галочка на синем фоне, сгенерировать скриптом через `sharp` или SVG → PNG)
- Modify: `src/app/layout.tsx` (`metadata`: title «Отклики», `appleWebApp`, `themeColor`)
- Create/Modify: `README.md`

- [ ] **Step 1:** `manifest.ts`: `name: 'Трекер откликов'`, `short_name: 'Отклики'`, `start_url: '/'`, `display: 'standalone'`, иконки 192/512. Без service worker'а (офлайн не нужен).
- [ ] **Step 2:** README на русском: что это; локальный запуск в memory-режиме; настройка — 4 шага из спеки (раздел «Настройка») с конкретными кликами в Google Cloud Console (включить Sheets API, служебный аккаунт + JSON-ключ, OAuth-клиент типа «Web application» с redirect `https://<домен>/api/auth/callback/google` и `http://localhost:3000/api/auth/callback/google`, доступ служебному аккаунту к таблице), переменные окружения в Vercel; перенос старых данных (Task 14).
- [ ] **Step 3:** `npm run build` → успешно; в Chrome DevTools → Application → Manifest ошибок нет.
- [ ] **Step 4: Commit** `feat: PWA manifest and setup README`.

### Task 13: Разбор старой таблицы (чистая логика)

**Files:**
- Create: `scripts/migrate/parse-legacy.ts`
- Test: `scripts/migrate/parse-legacy.test.ts` (добавить `scripts/**/*.test.ts` в `include` у vitest)

**Interfaces:**
- Consumes: `detectSource`, `extractFirstUrl` (Task 1), типы.
- Produces:
```ts
export function parseLegacyDayMonth(text: string, appliedAt: string): string | null; // первая дата в тексте → 'YYYY-MM-DD'
export interface LegacyRow { rowNumber: number; date: string; company: string; link: string; position: string; salary: string; s1: string; s2: string; s3: string }
export interface ParsedLegacy {
  application: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>;
  history: Omit<HistoryEntry, 'id' | 'applicationId'>[];   // первая — sent на appliedAt
  review: string[];                                        // причины для ручной проверки, [] если всё чисто
}
export function parseLegacyRow(row: LegacyRow): ParsedLegacy | null; // null для полностью пустой строки
export function parseLegacyVault(headerCellI: string, cellsI: string[]): { links: { title: string; url: string }[]; texts: { title: string; content: string }[] };
```

- [ ] **Step 1: Написать падающие тесты** на реальных данных (все пары взяты из старой вкладки):
```ts
it.each([
  ['реджект 02,09', '2026-08-11', '2026-09-02'],
  ['реджект 1109-изменили требования к вакансии', '2026-08-14', '2026-09-11'],
  ['звкрыли вакансию 30.10', '2026-10-19', '2026-10-30'],
  ['13.10', '2026-10-13', '2026-10-13'],
  ['9.11 получил письмо с анкетой и вопросами на почту, заполнил 12.11', '2026-11-09', '2026-11-09'],
  ['реджект 05,01', '2026-12-20', '2027-01-05'],                  // переход года
  ['закрыли вакансию, дали ссылку для мониторинга вакансий', '2026-11-03', null],
])('parseLegacyDayMonth(%s, %s) = %s', (t, a, e) => expect(parseLegacyDayMonth(t, a)).toBe(e));
```
  Тесты `parseLegacyRow` (строки собраны из реальных данных):
  - `{date:'11.08.2026', company:'patrianna', s1:'реджект 02,09', link:'https://jobs.ashbyhq.com/patrianna/9b9d', …}` → `appliedAt '2026-08-11'`, `source 'ashby'`, `status 'rejected'`, история `[sent@2026-08-11, rejected@2026-09-02]`.
  - `s1:'реджект 1109-изменили требования к вакансии'` → у записи `rejected` заметка `'изменили требования к вакансии'`.
  - `s1:'позиция уже закрыта 27,10'` (applied `25.08.2026`) → `rejected@2026-10-27`, заметка `'вакансия закрыта'`.
  - `s1:'закрыли вакансию, дали ссылку для мониторинга вакансий'` (applied `03.11.2026`), `s2:'https://example.com/careers'` → `rejected@2026-11-03`, заметка начинается с `'вакансия закрыта'`; URL из `s2` попадает в `application.notes`; записи истории для `s2` нет.
  - Akvelon: `{date:'13.10.2026', s1:'13.10', s2:'16,10 техническое'}` → история `[sent@10-13, interview(1)@10-13, interview(2)@10-16 'техническое']`, `status 'interview'`, `interviewStage 2`.
  - `s1:'09,09 написали что в течении 2-ух недель дадут фидбек'` (applied `07.09.2026`) → `screening@2026-09-09`, заметка — полный текст.
  - Две ссылки `'https://jobs.dou.ua/x https://comeet.com/y'` → `url 'https://jobs.dou.ua/x'`, `source 'dou'`, полный текст ячейки в `notes`.
  - `company` содержит URL → `review` непустой, запись всё равно возвращается.
  - `salary:'2500(в вакансии указано 4000-6000)'` → `salaryAsked` дословно; `salaryListed ''`.
  - `date:'02.07.2024'` → `appliedAt '2024-07-02'`.
  - `s1` не подходит ни под одно правило и без даты (`'что-то странное'`) → `screening` на `appliedAt` + `review` непустой.
  - `parseLegacyVault('Hello, my name is Rustam.\n…', ['Привіт, мене звати Рустам.\n…', 'https://drive.google.com/file/d/x', 'Hi, i would like…'])` → 3 текста (title — первые 40 символов первой строки), 1 ссылка (title — хост).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реализовать по таблице правил из спеки (раздел «Правила разбора колонок «собес»»). Даты: регулярка `/(\d{1,2})[.,](\d{2})|\b(\d{2})(\d{2})\b/` (первое совпадение); год берётся из `appliedAt`, если получилась дата раньше отклика — год +1. Признак закрытой вакансии — `/закры|звкры/i`, отказа — `/реджект|отказ/i`. Итоговый статус и этап — по последней записи истории (при равных датах — по порядку s1 → s2 → s3).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: legacy sheet parser`.

### Task 14: Скрипт переноса и запуск на реальных данных

**Files:**
- Create: `scripts/migrate/run.ts`, `scripts/migrate/dedupe.ts`
- Test: `scripts/migrate/dedupe.test.ts`
- Modify: `package.json` (`"migrate": "tsx scripts/migrate/run.ts"`)

**Interfaces:**
- Consumes: `parseLegacyRow`, `parseLegacyVault` (Task 13), `createGoogleSheetsClient`, `readRange` (Task 5), `createRepo` (Task 6), `applicationToRow`, `historyToRow` (Task 4).
- Produces: `dedupeKey(a: { company: string; url: string; appliedAt: string }): string` — нижний регистр + `trim` + без хвостового `/` у url, через `|`.

- [ ] **Step 1: Написать падающий тест** `dedupeKey`: `{company:' GR8_TECH ', url:'https://djinni.co/jobs/1/', appliedAt:'2026-08-14'}` и `{company:'gr8_tech', url:'https://djinni.co/jobs/1', appliedAt:'2026-08-14'}` дают одинаковый ключ; другая дата — другой ключ. → FAIL → реализовать → PASS.
- [ ] **Step 2:** Реализовать `run.ts`: читает `.env.local`; старая вкладка через `readRange(\`'${OLD_SHEET_TAB}'!A1:I\`)` у клиента с `OLD_SPREADSHEET_ID` (значения FORMATTED_VALUE, **не** gviz/CSV); строка 1 — заголовок (ячейка I1 идёт в `parseLegacyVault`). Флаг `--dry-run` только печатает отчёт: сколько строк, сколько по каждому статусу, список `review` с номерами строк, сколько дублей пропущено, что пойдёт в Копилку. Без флага: `ensureTabs`, пропускает строки, чьи `dedupeKey` уже есть в новой таблице, пишет applications и history пачками (`append` по 100 строк), шаблоны и ссылки — в разделы «Шаблоны» и «Ссылки» (создаёт их, если нет; не дублирует записи с таким же `content`); в конце тот же отчёт.
- [ ] **Step 3:** `npm test` и `npx tsc --noEmit` → успешно.
- [ ] **Step 4: Commit** `feat: migration script`.
- [ ] **Step 5: Запуск на реальных данных** (нужны шаги настройки из README; доступ служебного аккаунта к старой таблице — «Читатель»). `npm run migrate -- --dry-run`. Ожидаемо: 216 откликов; `rejected` ≈ 59 (54 «реджект» + 4 «закрыта/закрыли» + Amplitude); `interview` — 1 (Akvelon); `screening` — 2 (Interactive Online, codekeeper); `review` содержит строки с URL в компании (1) и в должности (2). Показать отчёт пользователю; после его «ок» — `npm run migrate`, затем повторный `--dry-run` должен показать 216 пропущенных дублей. Открыть приложение с `SHEETS_DRIVER` не равным `memory` и проверить, что сводка и таблица показывают перенесённые данные.
- [ ] **Step 6: Commit** (если что-то правилось) `chore: migration run fixes`.
