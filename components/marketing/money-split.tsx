import { formatCents, percentOf } from "@/lib/money";

/**
 * Where one membership payment goes. Segment order is charity | platform |
 * prize pool so the two confusable hues never touch, and every segment is also
 * labelled in text — colour is never the only way to tell them apart.
 */
export function MoneySplit({ amountCents, charityPercent, poolPercent, currency }: { amountCents: number; charityPercent: number; poolPercent: number; currency: string }) {
  const charity = percentOf(amountCents, charityPercent);
  const pool = percentOf(amountCents, poolPercent);
  const platform = amountCents - charity - pool;
  const segments = [
    { label: "Your charity", note: `at least ${charityPercent}%`, cents: charity, color: "var(--color-data-charity)" },
    { label: "Running the platform", note: "the rest", cents: platform, color: "var(--color-data-base)" },
    { label: "Monthly prize pool", note: `${poolPercent}%`, cents: pool, color: "var(--color-data-win)" },
  ];

  return (
    <figure>
      <div className="flex h-5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label} ${formatCents(s.cents, currency)}`).join(", ")}>
        {segments.map((segment) => (
          <div key={segment.label} style={{ width: `${(segment.cents / amountCents) * 100}%`, background: segment.color }} />
        ))}
      </div>
      <figcaption className="mt-5 grid gap-4 sm:grid-cols-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex gap-3">
            <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: segment.color }} />
            <span>
              <span className="tabular block font-[family-name:var(--font-display)] text-3xl text-ink">{formatCents(segment.cents, currency)}</span>
              <span className="block text-sm text-ink">{segment.label}</span>
              <span className="block text-xs text-ink-subtle">{segment.note}</span>
            </span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}
