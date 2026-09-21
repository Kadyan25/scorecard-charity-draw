"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/http";
import type { WinnerStage } from "@/services/winner-rules";

export function WinnerActions({ winnerId, stage }: { winnerId: string; stage: WinnerStage }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, body: object) {
    setPending(true);
    setError(null);
    const result = await sendJson(path, body);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setRejecting(false);
    startTransition(() => router.refresh());
  }

  if (stage === "under_review") {
    return (
      <div className="space-y-2">
        {rejecting ? (
          <div className="space-y-2">
            <label htmlFor={`note-${winnerId}`} className="sr-only">Reason for rejection</label>
            <textarea id={`note-${winnerId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Tell the winner what to fix" className="w-full rounded-lg border border-line-strong bg-canvas-raised p-2 text-sm focus:border-ember focus:outline-none" />
            <div className="flex gap-2">
              <Button size="sm" variant="danger" disabled={pending || !note.trim()} onClick={() => act("/api/admin/winners/review", { winnerId, decision: "rejected", note })}>Reject</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRejecting(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => act("/api/admin/winners/review", { winnerId, decision: "approved" })}>Approve</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(true)}>Reject…</Button>
          </div>
        )}
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    );
  }

  if (stage === "approved_unpaid") {
    return (
      <div className="space-y-2">
        <Button size="sm" variant="ink" disabled={pending} onClick={() => act("/api/admin/winners/payout", { winnerId })}>
          {pending ? "Saving…" : "Mark as paid"}
        </Button>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    );
  }

  return <span className="text-sm text-ink-subtle">—</span>;
}
