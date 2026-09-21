import Link from "next/link";
import { CharityCover } from "@/components/charity/charity-cover";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import type { CharityRow } from "@/lib/supabase/types";
import type { CharityImpact } from "@/services/charity";

export function CharityCard({ charity, impact }: { charity: CharityRow; impact?: CharityImpact }) {
  return (
    <Link
      href={`/charities/${charity.slug}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas-raised shadow-lift transition-all duration-300 hover:-translate-y-1 hover:shadow-raised"
    >
      <div className="h-44 overflow-hidden">
        <CharityCover charity={charity} className="transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge>{charity.category}</Badge>
          {charity.is_featured && <Badge tone="ember">Featured</Badge>}
        </div>
        <h3 className="text-2xl text-ink">{charity.name}</h3>
        {charity.tagline && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{charity.tagline}</p>}
        {impact && (
          <p className="tabular mt-auto pt-5 text-sm text-ink-subtle">
            {impact.supporters} {impact.supporters === 1 ? "supporter" : "supporters"}
            {impact.raisedCents > 0 && <> · {formatCents(impact.raisedCents)} raised</>}
          </p>
        )}
      </div>
    </Link>
  );
}
