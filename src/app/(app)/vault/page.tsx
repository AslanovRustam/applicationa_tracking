import { Suspense } from 'react';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { VaultApp } from '@/components/vault/VaultApp';
import { loadVaultData } from '@/lib/server/load-data';

export const metadata = { title: 'Копилка — Отклики' };

async function VaultData() {
  const { sections, items, applications } = await loadVaultData();
  return <VaultApp initial={{ sections, items }} applications={applications} />;
}

export default function VaultPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VaultData />
    </Suspense>
  );
}
