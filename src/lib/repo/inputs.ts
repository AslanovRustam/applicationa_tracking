import { z } from 'zod';
import { SOURCES, STATUSES, type Application, type Source, type VaultItem, type VaultItemType } from '@/lib/domain/types';

export type { StatusChange } from '@/lib/domain/types';

const required = z.string().trim().min(1, 'Обязательное поле');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD');
const dateOrDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Дата или дата-время');
const sourceEnum = z.enum(SOURCES as [Source, ...Source[]]);

const clientId = z.string().trim().min(1).max(64).optional();

export const newApplicationSchema = z.object({
  /** Client-generated id makes retries idempotent. */
  id: clientId,
  company: required,
  position: required,
  url: z.string().trim().default(''),
  appliedAt: date.optional(),
  source: sourceEnum.optional(),
  salaryAsked: z.string().optional(),
  salaryListed: z.string().optional(),
  contact: z.string().optional(),
  notes: z.string().optional(),
});
export type NewApplicationInput = z.input<typeof newApplicationSchema>;

export const applicationPatchSchema = z
  .object({
    appliedAt: date,
    company: required,
    position: required,
    url: z.string().trim(),
    source: sourceEnum,
    nextEventAt: dateOrDateTime.nullable(),
    salaryAsked: z.string(),
    salaryListed: z.string(),
    contact: z.string(),
    notes: z.string(),
  })
  .partial();
export type ApplicationPatch = Partial<
  Pick<
    Application,
    'appliedAt' | 'company' | 'position' | 'url' | 'source' | 'nextEventAt' | 'salaryAsked' | 'salaryListed' | 'contact' | 'notes'
  >
>;

export const statusChangeSchema = z.object({
  status: z.enum(STATUSES as [string, ...string[]]),
  interviewStage: z.number().int().positive().nullable(),
  at: dateOrDateTime,
  note: z.string(),
});

export const newVaultItemSchema = z.object({
  id: clientId,
  sectionId: required,
  type: z.enum(['link', 'text']),
  title: required,
  content: z.string(),
  tags: z.array(z.string().trim().min(1)),
});
export interface NewVaultItemInput {
  id?: string;
  sectionId: string;
  type: VaultItemType;
  title: string;
  content: string;
  tags: string[];
}

export const vaultItemPatchSchema = z
  .object({
    sectionId: required,
    type: z.enum(['link', 'text']),
    title: required,
    content: z.string(),
    tags: z.array(z.string().trim().min(1)),
    order: z.number().int(),
  })
  .partial();
export type VaultItemPatch = Partial<Omit<VaultItem, 'id'>>;

export const sectionNameSchema = required;
