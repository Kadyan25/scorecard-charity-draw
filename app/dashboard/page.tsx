import type { Metadata } from "next";
import { SubscriptionStatus } from "@/components/dashboard/subscription-status";
import { PageHeader } from "@/components/shell/page-header";
import { requireSubscriberContext } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const subscriber = await requireSubscriberContext();
  const firstName = subscriber.profile.full_name?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader eyebrow="Overview" title={`Hello, ${firstName}`} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <SubscriptionStatus access={subscriber.access} />
      </div>
    </>
  );
}
