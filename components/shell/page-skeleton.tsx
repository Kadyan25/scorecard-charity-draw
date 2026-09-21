/** Placeholder shown while a server-rendered page loads its data. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse">
      <div className="mb-3 h-3 w-24 rounded-full bg-line" />
      <div className="mb-8 h-10 w-72 max-w-full rounded-xl bg-line" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="h-40 rounded-[var(--radius-card)] border border-line bg-canvas-raised" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
