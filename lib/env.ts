import { z } from "zod";

/**
 * Environment is validated on first use so a misconfigured deploy fails loudly
 * with the missing variable named, rather than throwing deep inside a webhook.
 *
 * Stripe config is validated separately: the rest of the platform must keep
 * working even when payments are not configured yet.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;
export type StripeEnv = z.infer<typeof stripeSchema>;

function parse<T extends z.ZodTypeAny>(schema: T, source: unknown, scope: string): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid or missing ${scope} environment variables: ${missing}`);
  }
  return result.data;
}

function assertServer(name: string): void {
  if (typeof window !== "undefined") {
    throw new Error(`${name}() must never be called on the client`);
  }
}

let cachedServer: ServerEnv | null = null;
let cachedStripe: StripeEnv | null = null;

export function serverEnv(): ServerEnv {
  assertServer("serverEnv");
  cachedServer ??= parse(serverSchema, process.env, "server");
  return cachedServer;
}

export function stripeEnv(): StripeEnv {
  assertServer("stripeEnv");
  cachedStripe ??= parse(stripeSchema, process.env, "Stripe");
  return cachedStripe;
}

// Next.js inlines NEXT_PUBLIC_* at build time only for literal property access,
// so these cannot be read off a spread of process.env.
export const clientEnv: ClientEnv = parse(
  clientSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  "public",
);
