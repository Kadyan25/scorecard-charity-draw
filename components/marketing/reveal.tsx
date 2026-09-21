"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fades content up as it scrolls into view.
 *
 * Server-rendered HTML is always fully visible — nothing waits on JavaScript.
 * Only once the page is interactive, and only for content that is still below
 * the fold, is it hidden and then revealed on scroll. Content already on
 * screen is never touched, so there is no flash. Uses the .reveal utility in
 * globals.css, which also honours prefers-reduced-motion.
 */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const element = ref.current;
    if (!element || element.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setPhase("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setPhase("shown");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(phase !== "static" && "reveal", className)}
      data-visible={phase === "shown"}
      style={phase !== "static" && delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
