export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Загрузка">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-10 rounded-lg bg-muted" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-muted/70" />
      ))}
    </div>
  );
}
