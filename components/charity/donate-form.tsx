"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendJson } from "@/lib/http";
import { cn } from "@/lib/utils";

const PRESETS_POUNDS = [5, 10, 25, 50];

export function DonateForm({ charityId, charityName }: { charityId: string; charityName: string }) {
  const [pounds, setPounds] = useState<string>("10");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function donate() {
    const amountCents = Math.round(Number(pounds) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      return setError("The minimum donation is £1.");
    }
    setPending(true);
    setError(null);
    const result = await sendJson<{ url: string }>("/api/donations", { charityId, amountCents });
    if (!result.ok) {
      setPending(false);
      return setError(result.error);
    }
    window.location.assign(result.data.url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Donation amount">
        {PRESETS_POUNDS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setPounds(String(amount))}
            aria-pressed={pounds === String(amount)}
            className={cn(
              "tabular rounded-full border px-5 py-2 text-sm font-medium transition-colors",
              pounds === String(amount) ? "border-ember bg-ember text-white" : "border-line-strong text-ink hover:border-ember",
            )}
          >
            £{amount}
          </button>
        ))}
      </div>
      <div className="relative max-w-[10rem]">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">£</span>
        <label htmlFor="donation-amount" className="sr-only">Other amount in pounds</label>
        <Input id="donation-amount" type="number" min={1} step="1" inputMode="decimal" value={pounds} onChange={(e) => setPounds(e.target.value)} className="tabular pl-8" />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="button" onClick={donate} disabled={pending} size="lg">
        {pending ? "Opening secure checkout…" : `Give to ${charityName}`}
      </Button>
      <p className="text-xs text-ink-subtle">A one-off gift, separate from any membership. 100% goes to the charity.</p>
    </div>
  );
}
