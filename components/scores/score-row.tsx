"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScoreMutation } from "@/components/scores/use-score-mutation";
import type { ScoreRow as Score } from "@/lib/supabase/types";

type Mode = "view" | "edit" | "confirm-delete";

export function ScoreRow({ score, maxDate }: { score: Score; maxDate: string }) {
  const { run, error, setError, pending, send } = useScoreMutation();
  const [mode, setMode] = useState<Mode>("view");
  const [value, setValue] = useState(String(score.value));
  const [playedOn, setPlayedOn] = useState(score.played_on);

  function reset(next: Mode) {
    setError(null);
    setValue(String(score.value));
    setPlayedOn(score.played_on);
    setMode(next);
  }

  async function save() {
    const ok = await run(() => send(`/api/scores/${score.id}`, { value: Number(value), playedOn }, "PATCH"));
    if (ok) setMode("view");
  }

  async function remove() {
    await run(() => send(`/api/scores/${score.id}`, undefined, "DELETE"));
  }

  if (mode === "edit") {
    return (
      <li className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input aria-label="Stableford points" type="number" min={1} max={45} value={value} onChange={(e) => setValue(e.target.value)} className="tabular w-24" />
          <Input aria-label="Date played" type="date" max={maxDate} value={playedOn} onChange={(e) => setPlayedOn(e.target.value)} className="w-44" />
          <Button size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          <Button size="sm" variant="ghost" onClick={() => reset("view")} disabled={pending}>Cancel</Button>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
      </li>
    );
  }

  return (
    <li className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="tabular grid h-11 w-11 place-items-center rounded-full bg-canvas-sunken font-[family-name:var(--font-display)] text-lg text-ink">
            {score.value}
          </span>
          <div>
            <p className="font-medium text-ink">{score.value} Stableford points</p>
            <p className="text-sm text-ink-muted">{format(parseISO(score.played_on), "EEEE d MMMM yyyy")}</p>
          </div>
        </div>
        {mode === "confirm-delete" ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-ink-muted sm:inline">Delete this round?</span>
            <Button size="sm" variant="danger" onClick={remove} disabled={pending}>{pending ? "Deleting…" : "Delete"}</Button>
            <Button size="sm" variant="ghost" onClick={() => reset("view")} disabled={pending}>Keep</Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => reset("edit")} aria-label={`Edit round on ${score.played_on}`}>
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => reset("confirm-delete")} aria-label={`Delete round on ${score.played_on}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
    </li>
  );
}
