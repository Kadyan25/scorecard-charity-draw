"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/http";

/** Lets a signed-in member switch their subscription's cause from a profile page. */
export function SupportButton({ charityId, currentPercent }: { charityId: string; currentPercent: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    setPending(true);
    setError(null);
    const result = await sendJson("/api/charity", { charityId, charityPercent: currentPercent }, "PATCH");
    setPending(false);
    if (!result.ok) return setError(result.error);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={choose} disabled={pending} size="lg">
        {pending ? "Switching…" : "Make this my charity"}
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
