export type Status = 'sent' | 'screening' | 'interview' | 'offer' | 'rejected' | 'ghosted' | 'archived';

export const STATUSES: readonly Status[] = ['sent', 'screening', 'interview', 'offer', 'rejected', 'ghosted', 'archived'];

export type Source =
  | 'dou'
  | 'djinni'
  | 'linkedin'
  | 'robota'
  | 'workua'
  | 'nofluffjobs'
  | 'arbeitnow'
  | 'himalayas'
  | 'greenhouse'
  | 'ashby'
  | 'lever'
  | 'smartrecruiters'
  | 'dover'
  | 'company_site'
  | 'other';

export const SOURCES: readonly Source[] = [
  'dou',
  'djinni',
  'linkedin',
  'robota',
  'workua',
  'nofluffjobs',
  'arbeitnow',
  'himalayas',
  'greenhouse',
  'ashby',
  'lever',
  'smartrecruiters',
  'dover',
  'company_site',
  'other',
];

export interface Application {
  id: string;
  /** YYYY-MM-DD */
  appliedAt: string;
  company: string;
  position: string;
  url: string;
  source: Source;
  status: Status;
  interviewStage: number | null;
  /** YYYY-MM-DDTHH:mm, Kyiv local time */
  nextEventAt: string | null;
  salaryAsked: string;
  salaryListed: string;
  contact: string;
  notes: string;
  /** ISO UTC */
  createdAt: string;
  /** ISO UTC */
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  applicationId: string;
  status: Status;
  interviewStage: number | null;
  /** YYYY-MM-DD or YYYY-MM-DDTHH:mm */
  at: string;
  note: string;
}

export interface StatusChange {
  status: Status;
  interviewStage: number | null;
  at: string;
  note: string;
}

export interface VaultSection {
  id: string;
  name: string;
  order: number;
}

export type VaultItemType = 'link' | 'text';

export interface VaultItem {
  id: string;
  sectionId: string;
  type: VaultItemType;
  title: string;
  content: string;
  tags: string[];
  order: number;
}
