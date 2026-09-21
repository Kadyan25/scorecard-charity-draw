"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import { sendJson } from "@/lib/http";

interface Props extends Pick<ButtonProps, "variant"> {
  endpoint: "/api/stripe/checkout" | "/api/stripe/portal";
  body?: { planCode: "monthly" | "yearly" };
  label: string;
}

/** Posts to our server, which returns a Stripe-hosted URL to redirect to. */
export function StripeRedirectButton({ endpoint, body, label, variant }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setPending(true);
    setError(null);
    const result = await sendJson<{ url: string }>(endpoint, body);
    if (!result.ok) {
      setPending(false);
      return setError(result.error);
    }
    window.location.assign(result.data.url);
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={go} disabled={pending} variant={variant} size="lg" className="w-full">
        {pending ? "Opening secure checkout…" : label}
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
