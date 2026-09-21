import Link from "next/link";
import { Wordmark } from "@/components/marketing/wordmark";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-canvas-sunken">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Every round you play is an entry. Every subscription funds a cause you chose.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-medium text-ink">Platform</p>
          <ul className="space-y-2 text-ink-muted">
            <li><Link href="/how-it-works" className="hover:text-ink">How it works</Link></li>
            <li><Link href="/draws" className="hover:text-ink">Draw results</Link></li>
            <li><Link href="/subscribe" className="hover:text-ink">Pricing</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-medium text-ink">Giving</p>
          <ul className="space-y-2 text-ink-muted">
            <li><Link href="/charities" className="hover:text-ink">Charity directory</Link></li>
            <li><Link href="/signup" className="hover:text-ink">Choose a cause</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-line py-5 text-center text-xs text-ink-subtle">
        Built for the Digital Heroes selection process. Payments run in Stripe test mode.
      </p>
    </footer>
  );
}
