"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/http";

/** Publishing is irreversible, so it takes a deliberate second click. */
export function PublishDrawButton({ drawId, winnerCount }: { drawId: string; winnerCount: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setPending(true);
    setError(null);
    const result = await sendJson("/api/draws/publish", { drawId });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setConfirming(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ember/40 bg-ember-wash p-4">
          <p className="flex-1 text-sm text-ink">
            Publish these results? {winnerCount} {winnerCount === 1 ? "winner" : "winners"} will be notified in their dashboard. This cannot be undone.
          </p>
          <Button size="sm" onClick={publish} disabled={pending}>{pending ? "Publishing…" : "Yes, publish"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>Cancel</Button>
        </div>
      ) : (
        <Button onClick={() => setConfirming(true)} variant="ink">Publish results</Button>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
