"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendJson, type ApiResult } from "@/lib/http";

/**
 * Wraps a score API call: tracks pending state, surfaces the server's message
 * on failure, and refreshes the server-rendered page on success so the list,
 * ticket and eviction all reflect what the database actually did.
 */
export function useScoreMutation() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();

  async function run<T>(call: () => Promise<ApiResult<T>>): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  return { run, error, setError, pending: busy || refreshing, send: sendJson };
}
