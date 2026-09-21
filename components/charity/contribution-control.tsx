"use client";

import { formatCents, percentOf } from "@/lib/money";

interface Props {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Monthly plan price, used for the live "what this means" preview. */
  monthlyAmountCents: number;
  currency: string;
}

export function ContributionControl({ value, onChange, min, max, monthlyAmountCents, currency }: Props) {
  const perMonth = formatCents(percentOf(monthlyAmountCents, value), currency);

  return (
    <div className="rounded-xl border border-line bg-canvas-sunken p-4">
      <div className="flex items-baseline justify-between">
        <label htmlFor="charityPercent" className="text-sm font-medium text-ink">
          Your contribution
        </label>
        <span className="tabular font-[family-name:var(--font-display)] text-3xl text-ember">
          {value}%
        </span>
      </div>
      <input
        id="charityPercent"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[var(--color-ember)]"
        aria-valuetext={`${value} percent, about ${perMonth} a month`}
      />
      <p className="mt-2 text-sm text-ink-muted">
        About <strong className="text-ink">{perMonth}</strong> of a monthly subscription goes
        straight to your charity. Minimum {min}%, and you can change it any time.
      </p>
    </div>
  );
}
