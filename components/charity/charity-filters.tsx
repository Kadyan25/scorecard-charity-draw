"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Filters live in the URL, so results are server-rendered, shareable and work
 * without JavaScript; this component just keeps the URL in step with typing.
 */
export function CharityFilters({ categories, q, category }: { categories: string[]; q: string; category: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState(q);
  const [pending, startTransition] = useTransition();

  function push(nextTerm: string, nextCategory: string | null) {
    const params = new URLSearchParams();
    if (nextTerm.trim()) params.set("q", nextTerm.trim());
    if (nextCategory) params.set("category", nextCategory);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (term === q) return;
    const timer = setTimeout(() => push(term, category), 300);
    return () => clearTimeout(timer);
    // push is stable enough for a debounce; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const chip = (label: string, value: string | null) => (
    <button
      key={label}
      type="button"
      onClick={() => push(term, value)}
      aria-pressed={category === value}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm transition-colors",
        category === value ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-muted hover:border-ink hover:text-ink",
      )}
    >
      {label}
    </button>
  );

  return (
    <form role="search" action={pathname} className="space-y-4" onSubmit={(event) => { event.preventDefault(); push(term, category); }}>
      <div className="relative max-w-md">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <label htmlFor="charity-search" className="sr-only">Search charities</label>
        <Input id="charity-search" name="q" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name or cause" className="pl-11" />
      </div>
      <div className={cn("flex flex-wrap gap-2 transition-opacity", pending && "opacity-60")}>
        {chip("All causes", null)}
        {categories.map((value) => chip(value, value))}
      </div>
    </form>
  );
}
