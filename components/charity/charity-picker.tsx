"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { ContributionControl } from "@/components/charity/contribution-control";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/http";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name: string;
  category: string;
  tagline: string | null;
}

interface Props {
  options: Option[];
  currentId: string | null;
  currentPercent: number;
  min: number;
  max: number;
  monthlyAmountCents: number;
  currency: string;
}

export function CharityPicker(props: Props) {
  const router = useRouter();
  const [charityId, setCharityId] = useState(props.currentId ?? "");
  const [percent, setPercent] = useState(props.currentPercent);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const dirty = charityId !== (props.currentId ?? "") || percent !== props.currentPercent;

  async function save() {
    setSaving(true);
    setMessage(null);
    const result = await sendJson("/api/charity", { charityId, charityPercent: percent }, "PATCH");
    setSaving(false);
    if (!result.ok) return setMessage({ tone: "error", text: result.error });
    setMessage({ tone: "success", text: "Saved. Your next payment will follow this choice." });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-ink">Choose your cause</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {props.options.map((option) => {
            const selected = option.id === charityId;
            return (
              <label
                key={option.id}
                className={cn(
                  "relative flex cursor-pointer flex-col rounded-xl border p-4 transition-colors",
                  selected ? "border-ember bg-ember-wash" : "border-line bg-canvas-raised hover:border-line-strong",
                )}
              >
                <input type="radio" name="charity" value={option.id} checked={selected} onChange={() => setCharityId(option.id)} className="sr-only" />
                <span className="text-xs uppercase tracking-wider text-ink-subtle">{option.category}</span>
                <span className="mt-1 font-medium text-ink">{option.name}</span>
                {option.tagline && <span className="mt-1 text-sm text-ink-muted">{option.tagline}</span>}
                {selected && <Check aria-hidden className="absolute right-4 top-4 h-5 w-5 text-ember" />}
              </label>
            );
          })}
        </div>
      </fieldset>
      <ContributionControl value={percent} onChange={setPercent} min={props.min} max={props.max} monthlyAmountCents={props.monthlyAmountCents} currency={props.currency} />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button type="button" onClick={save} disabled={!dirty || !charityId || saving || refreshing}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
