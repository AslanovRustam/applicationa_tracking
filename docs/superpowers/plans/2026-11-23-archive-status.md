# Статус «Архив» — план

> Исполняется inline (superpowers:executing-plans), TDD.

**Goal:** добавить статус `archived` («Архив») с колонкой на доске и чипом-фильтром.
**Spec:** `docs/superpowers/specs/2026-11-23-archive-status-design.md`

### Task 1: Домен и схема

**Files:** `src/lib/domain/types.ts`, `status.ts`, `filter.ts`, `summary.ts`, `board.ts` (+ их тесты), `src/lib/sheets/schema.test.ts`

- [ ] Падающие тесты:
  - `statusBadgeLabel({status:'archived', interviewStage:null}) === 'Архив'`;
  - `filterApplications(..., {group:'archived'})` возвращает только `archived`; `groupCounts` содержит `archived`; `group:'active'` не включает `archived`;
  - `computeSummary`: `archived` не входит в `inProgress`, его `nextEventAt` не становится ближайшим событием;
  - `boardChangeFor(screening → 'archived')` → `{status:'archived', interviewStage:null, at, note:''}`; `archived → 'screening'` → смена статуса; `BOARD_COLUMNS` = `['screening','interview','offer','archived']`;
  - схема: строка со статусом `archived` читается.
- [ ] Реализация: `Status` += `'archived'`, `STATUSES`, `STATUS_LABELS.archived = 'Архив'`, `StatusGroup` += `'archived'` (подпись «Архив»), `STATUS_ORDER`, `summary` исключает `archived` из ближайшего события, `BoardColumn` += `'archived'`.
- [ ] `npm test` зелёный → commit.

### Task 2: UI

**Files:** `StatusBadge.tsx` (цвет), `Toolbar.tsx` (чип), `TrackerApp.tsx` (на доску идут `ACTIVE_STATUSES` + `archived`), `Board.tsx` (колонка «Архив», сортировка по `updatedAt` desc).

- [ ] Проверка в браузере (memory-режим на отдельном порту): перетаскивание в «Архив» и обратно, чип «Архив N», статус в карточке, «В процессе» уменьшается.
- [ ] build + commit.
