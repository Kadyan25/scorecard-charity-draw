import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listActiveCharities } from "@/services/charity";
import { listActivePlans, monthlyPlan } from "@/services/plans";
import { loadSettings } from "@/services/settings";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ charity?: string }>;
}) {
  const { charity: preselectSlug } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [charities, plans, settings] = await Promise.all([
    listActiveCharities(),
    listActivePlans(),
    loadSettings(supabase),
  ]);
  const preselected = charities.find((charity) => charity.slug === preselectSlug);

  return (
    <>
      <h1 className="text-4xl text-ink">Join Digital Heroes</h1>
      <p className="mb-8 mt-2 text-ink-muted">
        Pick the cause your subscription supports. You&apos;ll choose a plan next.
      </p>
      <SignupForm
        charities={charities.map(({ id, name, category }) => ({ id, name, category }))}
        percentMin={settings.charityPercentMin}
        percentMax={settings.charityPercentMax}
        monthlyAmountCents={monthlyPlan(plans)?.amount_cents ?? 0}
        currency={settings.currency}
        initialCharityId={preselected?.id}
      />
      <p className="mt-8 text-sm text-ink-muted">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-ember hover:text-ember-strong">
          Sign in
        </Link>
      </p>
    </>
  );
}
