import "server-only";

import Stripe from "stripe";
import { HttpError } from "@/lib/api";
import { stripeEnv } from "@/lib/env";

let client: Stripe | null = null;

/**
 * Lazily constructed so the rest of the platform keeps working when Stripe is
 * not configured — only payment routes fail, and they say why. The API version
 * is the SDK's pinned default, so types and payloads agree.
 */
export function stripe(): Stripe {
  if (client) return client;

  let secretKey: string;
  try {
    secretKey = stripeEnv().STRIPE_SECRET_KEY;
  } catch {
    throw new HttpError(503, "Payments are not configured on this environment yet.");
  }
  client = new Stripe(secretKey, { appInfo: { name: "Digital Heroes" } });
  return client;
}
