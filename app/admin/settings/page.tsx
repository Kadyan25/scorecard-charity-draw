import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadSettings } from "@/services/settings";

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await loadSettings(createSupabaseAdminClient());

  return (
    <>
      <PageHeader eyebrow="Settings" title="Money rules" description="Changes apply to future payments and draws. Published draws and recorded payments keep the values they were made with." />
      <Card>
        <SettingsForm
          initial={{
            prizePoolPercent: settings.prizePoolPercent,
            charityPercentMin: settings.charityPercentMin,
            charityPercentMax: settings.charityPercentMax,
            tierSplit: { ...settings.tierSplit },
          }}
        />
      </Card>
    </>
  );
}
