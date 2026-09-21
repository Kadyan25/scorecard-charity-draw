"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/http";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    const result = await sendJson("/api/auth/logout");
    setPending(false);
    if (!result.ok) return setFailed(true);
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={cn("text-sm text-ink-muted transition-colors hover:text-ink disabled:opacity-50", className)}
    >
      {failed ? "Sign out failed — retry" : pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
