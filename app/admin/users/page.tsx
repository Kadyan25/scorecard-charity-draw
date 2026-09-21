import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth";
import { listMembers, PAGE_SIZE } from "@/services/admin-members";
import type { AccessState } from "@/services/subscription";

export const metadata: Metadata = { title: "Users · Admin" };

const ACCESS: Record<AccessState, { label: string; tone: "positive" | "warning" | "negative" | "neutral" }> = {
  active: { label: "Active", tone: "positive" },
  cancelling: { label: "Cancelling", tone: "warning" },
  past_due: { label: "Past due", tone: "negative" },
  lapsed: { label: "Lapsed", tone: "negative" },
  none: { label: "No plan", tone: "neutral" },
};

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const { q = "", page: pageParam } = await searchParams;
  const { rows, total, page } = await listMembers({ q, page: Number(pageParam) || 1 });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (target: number) => `/admin/users?${new URLSearchParams({ ...(q && { q }), page: String(target) })}`;

  return (
    <>
      <PageHeader eyebrow="User management" title="Members" description={`${total} ${total === 1 ? "account" : "accounts"}. Open a member to edit their profile, scores or subscription.`} />
      <form role="search" className="relative mb-5 max-w-md">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <label htmlFor="member-search" className="sr-only">Search members</label>
        <Input id="member-search" name="q" type="search" defaultValue={q} placeholder="Search by name or email" className="pl-11" />
      </form>
      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">No members match that search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-line bg-canvas-sunken text-xs uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Member</th>
                  <th scope="col" className="px-5 py-3 font-medium">Subscription</th>
                  <th scope="col" className="px-5 py-3 font-medium">Charity</th>
                  <th scope="col" className="px-5 py-3 font-medium">Scores</th>
                  <th scope="col" className="px-5 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ profile, access, scoreCount, charityName }) => (
                  <tr key={profile.id} className="transition-colors hover:bg-canvas-sunken/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/users/${profile.id}`} className="font-medium text-ink hover:text-ember">{profile.full_name ?? "Unnamed member"}</Link>
                      <p className="text-xs text-ink-subtle">{profile.email}{profile.role === "admin" && " · admin"}</p>
                    </td>
                    <td className="px-5 py-3.5"><Badge tone={ACCESS[access.state].tone}>{ACCESS[access.state].label}</Badge></td>
                    <td className="px-5 py-3.5 text-ink-muted">{charityName ?? "—"} <span className="tabular text-xs">· {profile.charity_percent}%</span></td>
                    <td className="tabular px-5 py-3.5 text-ink">{scoreCount} / 5</td>
                    <td className="px-5 py-3.5 text-ink-muted">{format(parseISO(profile.created_at), "d MMM yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-5 flex items-center justify-between text-sm text-ink-muted">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={link(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Previous</Link>}
            {page < pages && <Link href={link(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Next</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
