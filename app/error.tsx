"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Shown when a page throws. The underlying error is logged on the server; the
 * visitor gets a way forward rather than a stack trace.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">Something went wrong</p>
      <h1 className="mt-3 text-4xl text-ink">We couldn&apos;t load this page.</h1>
      <p className="mt-4 text-ink-muted">
        It is probably temporary. Try again, and if it keeps happening, head back home and come back in a minute.
      </p>
      {error.digest && <p className="mt-3 text-xs text-ink-subtle">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>Go home</Link>
      </div>
    </main>
  );
}
