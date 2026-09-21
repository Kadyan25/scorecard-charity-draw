"use client";

import { AnimatePresence, motion } from "motion/react";
import { TICKET_SIZE } from "@/services/draw";
import { cn } from "@/lib/utils";

/**
 * The member's five scores rendered as draw balls. Empty slots stay visible so
 * "how many more rounds do I need" is answered at a glance.
 */
export function TicketBalls({ numbers, size = "md" }: { numbers: number[]; size?: "sm" | "md" }) {
  const slots = Array.from({ length: TICKET_SIZE }, (_, index) => numbers[index]);
  const dimension = size === "sm" ? "h-10 w-10 text-base" : "h-14 w-14 text-xl sm:h-16 sm:w-16 sm:text-2xl";

  return (
    <ol className="flex flex-wrap gap-2.5" aria-label="Your draw numbers">
      {slots.map((value, index) => (
        <li key={index} className={cn("relative", dimension)}>
          <AnimatePresence mode="popLayout" initial={false}>
            {value === undefined ? (
              <motion.span
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 grid place-items-center rounded-full border-2 border-dashed border-line-strong text-ink-subtle"
                aria-label="Empty slot"
              >
                ?
              </motion.span>
            ) : (
              <motion.span
                key={`${index}-${value}`}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className="tabular absolute inset-0 grid place-items-center rounded-full bg-ink font-[family-name:var(--font-display)] text-canvas shadow-lift"
              >
                {value}
              </motion.span>
            )}
          </AnimatePresence>
        </li>
      ))}
    </ol>
  );
}
