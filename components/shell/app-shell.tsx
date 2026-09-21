import { Wordmark } from "@/components/marketing/wordmark";
import { NavLink } from "@/components/shell/nav-link";
import { SignOutButton } from "@/components/shell/sign-out-button";

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

interface Props {
  nav: NavItem[];
  userLabel: string;
  badge?: string;
  children: React.ReactNode;
}

/**
 * Shared frame for the subscriber dashboard and the admin area. Navigation is a
 * horizontal scroller rather than a sidebar so it works unchanged on a phone.
 */
export function AppShell({ nav, userLabel, badge, children }: Props) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-canvas-raised">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Wordmark />
            {badge && (
              <span className="rounded-full bg-ember-wash px-2.5 py-0.5 text-xs font-medium text-ember-strong">
                {badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden max-w-[16rem] truncate text-sm text-ink-muted sm:inline">{userLabel}</span>
            <SignOutButton />
          </div>
        </div>
        <nav aria-label="Section" className="mx-auto max-w-6xl overflow-x-auto px-4 pb-3 sm:px-6">
          <div className="flex gap-1">
            {nav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
