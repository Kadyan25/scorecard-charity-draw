"use client";

import { useEffect, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScoreMutation } from "@/components/scores/use-score-mutation";
import type { ScoreLike } from "@/services/score-rules";

function localToday(): string {
  // en-CA formats as YYYY-MM-DD in the browser's own timezone.
  return new Date().toLocaleDateString("en-CA");
}

export function ScoreEntryForm({
  maxDate,
  nextToReplace,
  createUrl = "/api/scores",
}: {
  maxDate: string;
  nextToReplace: ScoreLike | null;
  /** Admins add scores for a member through their own endpoint. */
  createUrl?: string;
}) {
  const { run, error, pending, send } = useScoreMutation();
  const [value, setValue] = useState("");
  const [playedOn, setPlayedOn] = useState("");

  // Set after mount: the server cannot know the member's local date.
  useEffect(() => setPlayedOn(localToday()), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() => send(createUrl, { value: Number(value), playedOn }));
    if (ok) setValue("");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.3fr]">
        <div>
          <Label htmlFor="score-value">Stableford points</Label>
          <Input
            id="score-value"
            type="number"
            inputMode="numeric"
            min={1}
            max={45}
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="1–45"
            className="tabular text-lg"
          />
        </div>
        <div>
          <Label htmlFor="score-date">Date played</Label>
          <Input id="score-date" type="date" max={maxDate} required value={playedOn} onChange={(event) => setPlayedOn(event.target.value)} />
        </div>
      </div>
      {nextToReplace && (
        <p className="text-sm text-ink-muted">
          Your ticket is full, so this replaces your oldest round —{" "}
          <strong className="text-ink">{nextToReplace.value} pts</strong> on{" "}
          {format(parseISO(nextToReplace.played_on), "d MMM yyyy")}.
        </p>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={pending || !value || !playedOn} className="w-full sm:w-auto">
        {pending ? "Saving…" : "Add round"}
      </Button>
    </form>
  );
}
