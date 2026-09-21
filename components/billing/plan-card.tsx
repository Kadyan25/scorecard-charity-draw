import { Check } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { PlanRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const BENEFITS = [
  "Your five latest scores enter every monthly draw",
  "Win a share of the prize pool at 3, 4 or 5 matches",
  "At least 10% goes to the charity you choose",
];

export function PlanCard({
  plan,
  highlight,
  savingNote,
  children,
}: {
  plan: PlanRow;
  highlight?: boolean;
  savingNote?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[var(--radius-card)] border p-7 transition-shadow",
        highlight
          ? "border-ember bg-canvas-raised shadow-raised"
          : "border-line bg-canvas-raised shadow-lift",
      )}
    >
      {savingNote && (
        <span className="absolute -top-3 left-7 rounded-full bg-ember px-3 py-1 text-xs font-semibold text-white">
          {savingNote}
        </span>
      )}
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-subtle">{plan.name}</p>
      <p className="tabular mt-3 font-[family-name:var(--font-display)] text-5xl text-ink">
        {formatCents(plan.amount_cents, plan.currency)}
        <span className="font-[family-name:var(--font-sans)] text-base text-ink-muted"> / {plan.interval}</span>
      </p>
      <p className="mt-2 text-sm text-ink-muted">{plan.description}</p>
      <ul className="my-7 space-y-3 text-sm text-ink">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex gap-3">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
            {benefit}
          </li>
        ))}
      </ul>
      <div className="mt-auto">{children}</div>
    </div>
  );
}
