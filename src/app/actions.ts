'use server';

import { ZodError } from 'zod';
import type { ActionResult } from '@/lib/action-result';
import type { StatusChange } from '@/lib/domain/types';
import type { ApplicationPatch, NewApplicationInput, NewVaultItemInput, VaultItemPatch } from '@/lib/repo/inputs';
import type { Repo } from '@/lib/repo/repo';
import { NotFoundError } from '@/lib/sheets/client';
import { getRepo } from '@/lib/server/repo-instance';
import { UnauthorizedError, requireUser } from '@/lib/server/require-user';

function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? 'Проверьте заполненные поля';
  if (e instanceof NotFoundError) return 'Запись не найдена — возможно, её уже удалили';
  if (e instanceof UnauthorizedError) return 'Сессия истекла — войдите снова';
  return 'Не удалось сохранить. Попробуйте ещё раз.';
}

async function run<T>(fn: (repo: Repo) => Promise<T>): Promise<ActionResult<T>> {
  try {
    await requireUser();
    return { ok: true, data: await fn(await getRepo()) };
  } catch (e) {
    console.error('[action]', e);
    return { ok: false, error: errorMessage(e) };
  }
}

export async function createApplicationAction(input: NewApplicationInput) {
  return run((r) => r.createApplication(input, new Date()));
}

export async function updateApplicationAction(id: string, patch: ApplicationPatch) {
  return run((r) => r.updateApplication(id, patch, new Date()));
}

export async function changeStatusAction(id: string, change: StatusChange) {
  return run((r) => r.changeStatus(id, change, new Date()));
}

export async function markGhostedAction(ids: string[]) {
  return run((r) => r.markGhosted(ids, new Date()));
}

export async function deleteApplicationAction(id: string) {
  return run((r) => r.deleteApplication(id));
}

export async function createSectionAction(name: string) {
  return run((r) => r.createSection(name));
}

export async function renameSectionAction(id: string, name: string) {
  return run((r) => r.renameSection(id, name));
}

export async function deleteSectionAction(id: string) {
  return run((r) => r.deleteSection(id));
}

export async function reorderSectionsAction(orderedIds: string[]) {
  return run((r) => r.reorderSections(orderedIds));
}

export async function createItemAction(input: NewVaultItemInput) {
  return run((r) => r.createItem(input));
}

export async function updateItemAction(id: string, patch: VaultItemPatch) {
  return run((r) => r.updateItem(id, patch));
}

export async function deleteItemAction(id: string) {
  return run((r) => r.deleteItem(id));
}

export async function reorderItemsAction(sectionId: string, orderedIds: string[]) {
  return run((r) => r.reorderItems(sectionId, orderedIds));
}
