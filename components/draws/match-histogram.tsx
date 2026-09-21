/**
 * How entries matched the draw: one series, so no legend — the rows are labeled
 * directly and the whole thing is a real table, readable without the bars.
 * Winning rows use the accent mark and say "prize" in text.
 */
export function MatchHistogram({ histogram }: { histogram: number[] }) {
  const max = Math.max(1, ...histogram);
  const total = histogram.reduce((sum, count) => sum + count, 0);
  const rows = histogram.map((count, matches) => ({ matches, count })).reverse();

  return (
    <table className="w-full text-sm">
      <caption className="mb-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        How {total} {total === 1 ? "entry" : "entries"} matched
      </caption>
      <tbody>
        {rows.map(({ matches, count }) => {
          const wins = matches >= 3;
          const share = total ? Math.round((count / total) * 100) : 0;
          return (
            <tr key={matches} className="group" title={`${count} ${count === 1 ? "entry" : "entries"} matched ${matches} (${share}%)`}>
              <th scope="row" className="w-28 whitespace-nowrap py-1.5 pr-3 text-left font-normal text-ink-muted">
                {matches} {matches === 1 ? "match" : "matches"}
                {wins && <span className="ml-1.5 text-xs font-medium text-ink">· prize</span>}
              </th>
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 rounded-r-[4px] transition-opacity group-hover:opacity-80"
                    style={{
                      width: count === 0 ? "2px" : `${Math.max(2, (count / max) * 100)}%`,
                      background: wins ? "var(--color-data-win)" : "var(--color-data-base)",
                      opacity: count === 0 ? 0.35 : 1,
                    }}
                  />
                  <span className="tabular whitespace-nowrap text-ink">{count}</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
