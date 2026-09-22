import type { Metadata } from "next";
import { PasswordForm } from "@/components/dashboard/password-form";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const viewer = await requireUser();

  return (
    <>
      <PageHeader eyebrow="Profile & settings" title="Your account" description="Your name and sign-in details. Charity and contribution live under My charity; plan and payments under Billing." />
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardTitle>Details</CardTitle>
          <div className="mt-4">
            <ProfileForm fullName={viewer.profile.full_name ?? ""} email={viewer.email} />
          </div>
        </Card>
        <Card>
          <CardTitle>Password</CardTitle>
          <div className="mt-4">
            <PasswordForm />
          </div>
        </Card>
      </div>
    </>
  );
}
