import 'server-only';
import { readFileSync } from 'node:fs';
import { buildFixtures } from '@/lib/dev/fixtures';
import { createRepo, type Repo } from '@/lib/repo/repo';
import type { SheetsClient } from '@/lib/sheets/client';
import { resolveCredentialsJson } from '@/lib/sheets/credentials';
import { createGoogleSheetsClient } from '@/lib/sheets/google-client';
import { createMemorySheetsClient } from '@/lib/sheets/memory-client';

const g = globalThis as unknown as { __jobTracker?: { repo: Repo; ready: Promise<void> } };

function createClient(): SheetsClient {
  if (process.env.SHEETS_DRIVER === 'memory' && process.env.NODE_ENV !== 'production') {
    return createMemorySheetsClient(buildFixtures(new Date()));
  }
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID не задан (или SHEETS_DRIVER=memory для разработки)');
  }
  const credentialsJson = resolveCredentialsJson(process.env, (p) => readFileSync(p, 'utf8'));
  return createGoogleSheetsClient({ spreadsheetId, credentialsJson });
}

export async function getRepo(): Promise<Repo> {
  if (!g.__jobTracker) {
    const client = createClient();
    const ready = client.ensureTabs();
    g.__jobTracker = { repo: createRepo(client), ready };
    ready.catch(() => {
      g.__jobTracker = undefined; // retry tab setup on the next request
    });
  }
  await g.__jobTracker.ready;
  return g.__jobTracker.repo;
}
