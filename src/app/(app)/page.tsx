import { Suspense } from 'react';
import { TrackerApp } from '@/components/tracker/TrackerApp';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { loadPageData } from '@/lib/server/load-data';

async function TrackerData() {
  const { applications, history, items } = await loadPageData();
  return <TrackerApp initial={{ applications, history }} vaultItems={items} />;
}

export default function TrackerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TrackerData />
    </Suspense>
  );
}
