import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CharityForm } from "@/components/admin/charity-form";
import { CharityEventsManager, CharityImageUpload, DeleteCharityButton } from "@/components/admin/charity-media-and-events";
import { CharityCover } from "@/components/charity/charity-cover";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardEyebrow } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { recordIdSchema } from "@/lib/validation";
import { getCharityForAdmin, listAllCharities } from "@/services/admin-charities";

export const metadata: Metadata = { title: "Edit charity · Admin" };

export default async function EditCharityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const parsed = recordIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const [found, all] = await Promise.all([getCharityForAdmin(parsed.data), listAllCharities()]);
  if (!found) notFound();
  const { charity, events } = found;
  const categories = [...new Set(all.map((row) => row.category))].sort();

  return (
    <>
      <Link href="/admin/charities" className="mb-4 inline-block text-sm text-ink-muted hover:text-ink">← All charities</Link>
      <PageHeader
        eyebrow="Charity management"
        title={charity.name}
        action={charity.is_active ? <Link href={`/charities/${charity.slug}`} className="text-sm font-medium text-ember hover:text-ember-strong">View public page →</Link> : undefined}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CharityForm
            categories={categories}
            initial={{
              id: charity.id,
              name: charity.name,
              slug: charity.slug,
              tagline: charity.tagline ?? "",
              description: charity.description,
              mission: charity.mission ?? "",
              category: charity.category,
              websiteUrl: charity.website_url ?? "",
              isFeatured: charity.is_featured,
              isActive: charity.is_active,
            }}
          />
        </Card>
        <div className="space-y-5">
          <Card>
            <CardEyebrow>Cover photo</CardEyebrow>
            <div className="mb-4 h-40 overflow-hidden rounded-xl"><CharityCover charity={charity} /></div>
            <CharityImageUpload charityId={charity.id} />
          </Card>
          <Card>
            <CardEyebrow>Events</CardEyebrow>
            <CharityEventsManager charityId={charity.id} events={events} />
          </Card>
          <Card>
            <CardEyebrow>Danger zone</CardEyebrow>
            <p className="mb-3 text-sm text-ink-muted">Charities with supporters or donations cannot be deleted; untick “Listed publicly” instead.</p>
            <DeleteCharityButton charityId={charity.id} name={charity.name} />
          </Card>
        </div>
      </div>
    </>
  );
}
