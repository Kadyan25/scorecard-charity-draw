import { formatCents } from "@/lib/money";
import type { AdminEntry } from "@/services/draw-queries";

export function DrawWinnersTable({ entries }: { entries: AdminEntry[] }) {
  const winners = entries.filter((entry) => entry.tier !== null);
  if (winners.length === 0) {
    return <p className="text-sm text-ink-muted">No entry matched three or more numbers.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[32rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-subtle">
          <tr><th scope="col" className="pb-2 font-medium">Member</th><th scope="col" className="pb-2 font-medium">Numbers</th><th scope="col" className="pb-2 font-medium">Matched</th><th scope="col" className="pb-2 font-medium">Prize</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {winners.map((entry) => (
            <tr key={entry.id}>
              <td className="py-2.5"><p className="text-ink">{entry.memberName}</p><p className="text-xs text-ink-subtle">{entry.memberEmail}</p></td>
              <td className="py-2.5 text-ink-muted">{entry.numbers.join(" · ")}</td>
              <td className="py-2.5 text-ink">{entry.matched_count}</td>
              <td className="py-2.5 font-medium text-ink">{formatCents(entry.prize_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
