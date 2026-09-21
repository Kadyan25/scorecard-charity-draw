"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/http";
import type { AdminSubscriptionAction } from "@/services/subscription";

const LABELS: Record<AdminSubscriptionAction, { label: string; confirm?: string; variant: "primary" | "outline" | "danger" }> = {
  cancel_at_period_end: { label: "Cancel at period end", variant: "outline" },
  resume: { label: "Resume renewal", variant: "primary" },
  cancel_now: { label: "Cancel immediately", confirm: "End access now? The member keeps no remaining time.", variant: "danger" },
  grant_comp: { label: "Grant 30 days free", variant: "primary" },
  end_comp: { label: "End complimentary access", confirm: "End this member's access now?", variant: "danger" },
};

export function SubscriptionActions({ userId, actions }: { userId: string; actions: AdminSubscriptionAction[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<AdminSubscriptionAction | null>(null);
  const [confirming, setConfirming] = useState<AdminSubscriptionAction | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(action: AdminSubscriptionAction) {
    if (LABELS[action].confirm && confirming !== action) return setConfirming(action);
    setConfirming(null);
    setPending(action);
    setError(null);
    const result = await sendJson(`/api/admin/users/${userId}/subscription`, { action });
    setPending(null);
    if (!result.ok) return setError(result.error);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={action} size="sm" variant={LABELS[action].variant} disabled={pending !== null} onClick={() => run(action)}>
            {pending === action ? "Working…" : confirming === action ? "Click again to confirm" : LABELS[action].label}
          </Button>
        ))}
      </div>
      {confirming && <p className="text-sm text-ink-muted">{LABELS[confirming].confirm}</p>}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
