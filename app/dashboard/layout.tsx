import { AppShell, type NavItem } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/scores", label: "My scores" },
  { href: "/dashboard/charity", label: "My charity" },
  { href: "/dashboard/draws", label: "Draws" },
  { href: "/dashboard/winnings", label: "Winnings" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/profile", label: "Profile" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireUser();
  return (
    <AppShell nav={NAV} userLabel={viewer.profile.full_name ?? viewer.email}>
      {children}
    </AppShell>
  );
}
