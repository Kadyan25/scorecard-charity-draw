import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/services/stripe-webhook";

// Signature verification needs the exact raw body, so this route must never be
// cached or have its body parsed before we read it.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = stripe().webhooks.constructEvent(payload, signature, stripeEnv().STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid payload";
    return NextResponse.json({ error: `Webhook rejected: ${message}` }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    // A 500 makes Stripe retry with backoff, which is what we want for a
    // transient database failure.
    console.error(`Stripe event ${event.id} (${event.type}) failed`, error);
    return NextResponse.json({ error: "Event processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
