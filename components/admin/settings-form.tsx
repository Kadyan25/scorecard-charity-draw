"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/http";

interface Values {
  prizePoolPercent: number;
  charityPercentMin: number;
  charityPercentMax: number;
  tierSplit: { 5: number; 4: number; 3: number };
}

function Field({ id, label, value, onChange, hint }: { id: string; label: string; value: number; onChange: (value: number) => void; hint?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type="number" min={0} max={100} value={Number.isNaN(value) ? "" : value} onChange={(e) => onChange(e.target.valueAsNumber)} className="tabular pr-9" />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-subtle">%</span>
      </div>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const tierTotal = values.tierSplit[5] + values.tierSplit[4] + values.tierSplit[3];
  const setTier = (tier: 5 | 4 | 3, value: number) => setValues({ ...values, tierSplit: { ...values.tierSplit, [tier]: value } });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await sendJson("/api/admin/settings", values, "PATCH");
    setPending(false);
    if (!result.ok) return setMessage({ tone: "error", text: result.error });
    setMessage({ tone: "success", text: "Saved. New values apply to future payments and draws." });
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={save} className="space-y-8" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 font-medium text-ink">Membership split</legend>
        <Field id="pool" label="Prize pool share" value={values.prizePoolPercent} onChange={(v) => setValues({ ...values, prizePoolPercent: v })} hint="Of every payment" />
        <Field id="min" label="Charity minimum" value={values.charityPercentMin} onChange={(v) => setValues({ ...values, charityPercentMin: v })} hint="At least 10%" />
        <Field id="max" label="Charity maximum" value={values.charityPercentMax} onChange={(v) => setValues({ ...values, charityPercentMax: v })} hint={`Up to ${100 - values.prizePoolPercent}% with this pool share`} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 font-medium text-ink">Prize tiers <span className={tierTotal === 100 ? "text-moss" : "text-rose"}>· total {Number.isNaN(tierTotal) ? "—" : tierTotal}%</span></legend>
        <Field id="t5" label="5 matches (jackpot)" value={values.tierSplit[5]} onChange={(v) => setTier(5, v)} />
        <Field id="t4" label="4 matches" value={values.tierSplit[4]} onChange={(v) => setTier(4, v)} />
        <Field id="t3" label="3 matches" value={values.tierSplit[3]} onChange={(v) => setTier(3, v)} />
      </fieldset>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
    </form>
  );
}
