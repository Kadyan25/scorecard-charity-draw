"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { formatCents } from "@/lib/money";

/**
 * Counts up to a figure as it scrolls into view.
 *
 * The real value is what the server renders, so the figure is correct with
 * JavaScript off or still loading. The count-up only runs for figures below
 * the fold when the page becomes interactive, and not at all when the visitor
 * prefers reduced motion.
 */
export function CountUp({ value, format = "number" }: { value: number; format?: "number" | "cents" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const element = ref.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!element || reduce || value === 0 || element.getBoundingClientRect().top < window.innerHeight) return;

    setShown(0);
    let stop: (() => void) | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      stop = animate(0, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (latest) => setShown(Math.round(latest)) }).stop;
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      stop?.();
    };
  }, [value]);

  const render = (amount: number) => (format === "cents" ? formatCents(amount) : amount.toLocaleString("en-GB"));
  return (
    <span ref={ref} className="tabular" aria-label={render(value)}>
      {render(shown)}
    </span>
  );
}
