"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/http";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "random", title: "Random", body: "Classic lottery: every number from 1 to 45 is equally likely." },
  { value: "algorithmic", title: "Algorithmic", body: "Weighted by how often members actually scored each number this month." },
] as const;

type Mode = (typeof MODES)[number]["value"];

export function DrawControls({ month, locked }: { month: string; locked: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("random");
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeMonth(value: string) {
    if (value) startTransition(() => router.push(`/admin/draws?month=${value}`));
  }

  async function simulate() {
    setPending(true);
    setError(null);
    const result = await sendJson("/api/draws/simulate", { month, mode });
    setPending(false);
    if (!result.ok) return setError(result.error);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      <div className="max-w-[14rem]">
        <Label htmlFor="draw-month">Draw month</Label>
        <Input id="draw-month" type="month" value={month} onChange={(event) => changeMonth(event.target.value)} />
      </div>
      <fieldset disabled={locked}>
        <legend className="mb-2 text-sm font-medium text-ink">Draw logic</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((option) => (
            <label key={option.value} className={cn("cursor-pointer rounded-xl border p-4 transition-colors", mode === option.value ? "border-ember bg-ember-wash" : "border-line hover:border-line-strong", locked && "cursor-not-allowed opacity-60")}>
              <input type="radio" name="mode" value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} className="sr-only" />
              <span className="font-medium text-ink">{option.title}</span>
              <span className="mt-1 block text-sm text-ink-muted">{option.body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="button" onClick={simulate} disabled={pending || locked}>
        {pending ? "Running simulation…" : "Run simulation"}
      </Button>
      {locked && <p className="text-sm text-ink-muted">This month is published and can no longer be re-drawn.</p>}
    </div>
  );
}
