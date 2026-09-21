import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { MobileNav } from "@/components/marketing/mobile-nav";
import { Wordmark } from "@/components/marketing/wordmark";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/charities", label: "Charities" },
  { href: "/draws", label: "Draw results" },
];

export async function SiteHeader() {
  const viewer = await getViewer();
  const account = viewer
    ? { href: viewer.profile.role === "admin" ? "/admin" : "/dashboard", label: viewer.profile.role === "admin" ? "Admin" : "My dashboard" }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-ink-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {account ? (
            <Link href={account.href} className={buttonVariants({ variant: "ink", size: "sm" })}>{account.label}</Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>Sign in</Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>Join now</Link>
            </>
          )}
        </div>
        <MobileNav links={NAV} account={account} />
      </div>
    </header>
  );
}
