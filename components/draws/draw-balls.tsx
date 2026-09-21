"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Drawn numbers, revealed one after another like balls leaving a machine.
 * When `mine` is given, the member's matching numbers are marked — with a ring
 * and an accessible label, not by color alone.
 */
export function DrawBalls({ numbers, mine, size = "md" }: { numbers: number[]; mine?: number[]; size?: "sm" | "md" | "lg" }) {
  const reduce = useReducedMotion();
  const matched = new Set(mine ?? []);
  const dimension = { sm: "h-9 w-9 text-sm", md: "h-12 w-12 text-lg", lg: "h-16 w-16 text-2xl sm:h-20 sm:w-20 sm:text-3xl" }[size];

  return (
    <ol className="flex flex-wrap gap-2.5" aria-label="Drawn numbers">
      {numbers.map((value, index) => {
        const hit = mine !== undefined && matched.has(value);
        return (
          <motion.li
            key={`${index}-${value}`}
            initial={reduce ? false : { y: -16, opacity: 0, rotate: -90 }}
            whileInView={{ y: 0, opacity: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.12, type: "spring", stiffness: 300, damping: 18 }}
            className={cn(
              "tabular grid place-items-center rounded-full font-[family-name:var(--font-display)] shadow-lift",
              dimension,
              hit ? "bg-ember text-white ring-4 ring-ember/25" : "bg-canvas-raised text-ink ring-1 ring-line-strong",
            )}
            aria-label={hit ? `${value}, one of your numbers` : String(value)}
          >
            {value}
          </motion.li>
        );
      })}
    </ol>
  );
}
