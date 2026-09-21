import Link from "next/link";
import { Wordmark } from "@/components/marketing/wordmark";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <Wordmark />
      <p className="tabular mt-12 font-[family-name:var(--font-display)] text-8xl text-ember-soft">404</p>
      <h1 className="mt-2 text-4xl text-ink">That page is out of bounds.</h1>
      <p className="mt-4 text-ink-muted">The link may be old, or the page may have moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants()}>Back to the homepage</Link>
        <Link href="/charities" className={buttonVariants({ variant: "outline" })}>Browse charities</Link>
      </div>
    </main>
  );
}
