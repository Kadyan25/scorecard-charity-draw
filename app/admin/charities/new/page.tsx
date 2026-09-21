import type { Metadata } from "next";
import Link from "next/link";
import { CharityForm } from "@/components/admin/charity-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { listAllCharities } from "@/services/admin-charities";

export const metadata: Metadata = { title: "New charity · Admin" };

export default async function NewCharityPage() {
  await requireAdmin();
  const categories = [...new Set((await listAllCharities()).map((charity) => charity.category))].sort();

  return (
    <>
      <Link href="/admin/charities" className="mb-4 inline-block text-sm text-ink-muted hover:text-ink">← All charities</Link>
      <PageHeader eyebrow="Charity management" title="Add a charity" description="Photography and events can be added once it is saved." />
      <Card>
        <CharityForm
          categories={categories}
          initial={{ name: "", slug: "", tagline: "", description: "", mission: "", category: "", websiteUrl: "", isFeatured: false, isActive: true }}
        />
      </Card>
    </>
  );
}
