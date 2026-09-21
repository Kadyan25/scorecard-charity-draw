import Link from "next/link";
import { CharitySpotlight } from "@/components/marketing/charity-spotlight";
import { buttonVariants } from "@/components/ui/button";
import { getFeaturedCharity, loadImpact } from "@/services/charity";

// Hero is a placeholder until the full homepage lands in Phase 8.
export default async function HomePage() {
  const [featured, impact] = await Promise.all([getFeaturedCharity(), loadImpact()]);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-ember">Play · Win · Give</p>
        <h1 className="max-w-3xl text-5xl leading-[1.05] text-ink sm:text-7xl">
          Your five best rounds, working for something bigger.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-muted">
          Log your scores. They become your numbers in the monthly draw. And part of every
          subscription goes to a charity you choose.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>Join and choose a cause</Link>
          <Link href="/charities" className={buttonVariants({ variant: "outline", size: "lg" })}>Explore charities</Link>
        </div>
      </section>
      {featured && <CharitySpotlight charity={featured} impact={impact.get(featured.id)} />}
    </>
  );
}
