import { AppShell, type NavItem } from "@/components/shell/app-shell";
import { requireAdmin } from "@/lib/auth";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/draws", label: "Draws" },
  { href: "/admin/charities", label: "Charities" },
  { href: "/admin/winners", label: "Winners" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <AppShell nav={NAV} userLabel={viewer.email} badge="Admin">
      {children}
    </AppShell>
  );
}
