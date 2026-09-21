import type { Metadata } from "next";
import Link from "next/link";
import { CharityCover } from "@/components/charity/charity-cover";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { listAllCharities } from "@/services/admin-charities";

export const metadata: Metadata = { title: "Charities · Admin" };

export default async function AdminCharitiesPage() {
  await requireAdmin();
  const charities = await listAllCharities();

  return (
    <>
      <PageHeader
        eyebrow="Charity management"
        title="Charities"
        description="Add and edit the causes members can choose, their photography and events."
        action={<Link href="/admin/charities/new" className={buttonVariants()}>New charity</Link>}
      />
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line bg-canvas-sunken text-xs uppercase tracking-wider text-ink-subtle">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Charity</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">Supporters</th>
                <th scope="col" className="px-5 py-3 font-medium">Donations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {charities.map((charity) => (
                <tr key={charity.id} className="transition-colors hover:bg-canvas-sunken/60">
                  <td className="px-5 py-3">
                    <Link href={`/admin/charities/${charity.id}`} className="flex items-center gap-4">
                      <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md"><CharityCover charity={charity} /></span>
                      <span><span className="font-medium text-ink hover:text-ember">{charity.name}</span><span className="block text-xs text-ink-subtle">{charity.category}</span></span>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={charity.is_active ? "positive" : "neutral"}>{charity.is_active ? "Listed" : "Hidden"}</Badge>
                      {charity.is_featured && <Badge tone="ember">Featured</Badge>}
                    </div>
                  </td>
                  <td className="tabular px-5 py-3 text-ink">{charity.supporters}</td>
                  <td className="tabular px-5 py-3 text-ink">{charity.donations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
