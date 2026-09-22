import Link from "next/link";
import { CharityCover } from "@/components/charity/charity-cover";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import type { CharityRow } from "@/lib/supabase/types";
import type { CharityImpact } from "@/services/charity";

/** Homepage featured-charity section. */
export function CharitySpotlight({ charity, impact }: { charity: CharityRow; impact?: CharityImpact }) {
  return (
    <section aria-labelledby="spotlight-heading" className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="grid overflow-hidden rounded-[1.5rem] border border-line bg-canvas-raised shadow-raised md:grid-cols-2">
        <div className="min-h-64">
          <CharityCover charity={charity} size="lg" />
        </div>
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ember">Charity spotlight</p>
          <h2 id="spotlight-heading" className="mt-3 text-4xl leading-tight text-ink">{charity.name}</h2>
          {charity.tagline && <p className="mt-3 text-lg text-ink-muted">{charity.tagline}</p>}
          {charity.mission && <p className="mt-5 text-ink">{charity.mission}</p>}
          {impact && (
            <p className="tabular mt-5 text-sm text-ink-subtle">
              {impact.supporters} members supporting{impact.raisedCents > 0 && ` · ${formatCents(impact.raisedCents)} raised so far`}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/charities/${charity.slug}`} className={buttonVariants()}>Meet {charity.name.split(" ")[0]}</Link>
            <Link href="/charities" className={buttonVariants({ variant: "outline" })}>All charities</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
