import { formatCents, splitEqually } from "@/lib/money";
import type { DrawRow } from "@/lib/supabase/types";
import type { WinnerCounts } from "@/services/draw-queries";

type Tier = 5 | 4 | 3;

const TIERS: { tier: Tier; label: string; share: string; rolls: boolean }[] = [
  { tier: 5, label: "5 numbers", share: "40%", rolls: true },
  { tier: 4, label: "4 numbers", share: "35%", rolls: false },
  { tier: 3, label: "3 numbers", share: "25%", rolls: false },
];

function tierPool(draw: DrawRow, tier: Tier): number {
  return tier === 5 ? draw.tier5_pool_cents : tier === 4 ? draw.tier4_pool_cents : draw.tier3_pool_cents;
}

/** Where every penny of the month's pool went. */
export function PrizeBreakdown({ draw, winners }: { draw: DrawRow; winners: WinnerCounts }) {
  return (
    <div className="space-y-5">
      <dl className="tabular grid grid-cols-3 gap-4 text-sm">
        <div><dt className="text-ink-muted">From members</dt><dd className="mt-1 text-lg text-ink">{formatCents(draw.pool_total_cents - draw.rollover_in_cents)}</dd></div>
        <div><dt className="text-ink-muted">Rolled in</dt><dd className="mt-1 text-lg text-ink">{formatCents(draw.rollover_in_cents)}</dd></div>
        <div><dt className="text-ink-muted">Total pool</dt><dd className="mt-1 font-[family-name:var(--font-display)] text-2xl text-ember">{formatCents(draw.pool_total_cents)}</dd></div>
      </dl>
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[28rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-subtle">
            <tr><th scope="col" className="pb-2 font-medium">Match</th><th scope="col" className="pb-2 font-medium">Pool</th><th scope="col" className="pb-2 font-medium">Winners</th><th scope="col" className="pb-2 font-medium">Each</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {TIERS.map(({ tier, label, share, rolls }) => {
              const pool = tierPool(draw, tier);
              const count = winners[tier];
              return (
                <tr key={tier}>
                  <td className="py-2.5 text-ink">{label} <span className="text-ink-subtle">· {share}</span></td>
                  <td className="py-2.5 text-ink">{formatCents(pool)}</td>
                  <td className="py-2.5 text-ink">{count}</td>
                  <td className="py-2.5 text-ink">
                    {count > 0 ? formatCents(splitEqually(pool, count).share) : <span className="text-ink-muted">{rolls ? "Rolls over" : "To charity"}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <dl className="tabular grid grid-cols-2 gap-4 rounded-xl bg-canvas-sunken p-4 text-sm">
        <div><dt className="text-ink-muted">Carries to next draw</dt><dd className="mt-1 text-lg text-ink">{formatCents(draw.rollover_out_cents)}</dd></div>
        <div><dt className="text-ink-muted">Unclaimed, sent to charity</dt><dd className="mt-1 text-lg text-moss">{formatCents(draw.charity_bonus_cents)}</dd></div>
      </dl>
    </div>
  );
}
