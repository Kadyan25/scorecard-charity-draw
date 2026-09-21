import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function CharityNotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-4xl text-ink">We couldn&apos;t find that charity</h1>
      <p className="mt-4 text-ink-muted">It may have been renamed or is no longer taking part.</p>
      <Link href="/charities" className={buttonVariants({ className: "mt-8" })}>Browse all charities</Link>
    </section>
  );
}
