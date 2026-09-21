import type { Metadata } from "next";
import { CharityCard } from "@/components/charity/charity-card";
import { CharityFilters } from "@/components/charity/charity-filters";
import { loadImpact, searchCharities } from "@/services/charity";

export const metadata: Metadata = {
  title: "Charities",
  description: "Every member chooses a cause. Explore the charities your subscription can support.",
};

export default async function CharitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const filters = await searchParams;
  const [{ charities, categories, category, q }, impact] = await Promise.all([searchCharities(filters), loadImpact()]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">The causes</p>
      <h1 className="mt-3 max-w-3xl text-5xl leading-[1.05] text-ink sm:text-6xl">
        Pick who your game plays for.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted">
        At least 10% of every membership goes to the charity you choose — and you can raise it any time.
      </p>
      <div className="mt-10">
        <CharityFilters categories={categories} q={q} category={category} />
      </div>
      <p className="mt-8 text-sm text-ink-subtle" aria-live="polite">
        {charities.length} {charities.length === 1 ? "charity" : "charities"}
        {category && ` in ${category}`}
        {q && ` matching “${q}”`}
      </p>
      {charities.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line-strong p-12 text-center text-ink-muted">
          No charities match that search. Try a different word or clear the filters.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {charities.map((charity) => (
            <CharityCard key={charity.id} charity={charity} impact={impact.get(charity.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
