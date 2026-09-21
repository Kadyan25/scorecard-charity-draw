"use client";

import { motion, useReducedMotion } from "motion/react";
import { HeartHandshake, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const MY_SCORES = [34, 29, 31, 27, 36];
const DRAWN = [12, 29, 31, 36, 41];
const MATCHED = new Set(MY_SCORES.filter((score) => DRAWN.includes(score)));

/**
 * The product's mechanic, shown rather than described: a member's five scores,
 * the monthly draw landing one ball at a time, and the matches lighting up.
 * Decorative — the same story is told in text beside it.
 */
export function HeroTicket({ charityName, charityShare }: { charityName: string; charityShare: string }) {
  const reduce = useReducedMotion();
  const drawDelay = (index: number) => (reduce ? 0 : 0.9 + index * 0.35);

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-8 -z-10 rounded-full bg-ember-soft/40 blur-3xl" />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 30, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -1.5 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[1.5rem] border border-line bg-canvas-raised p-7 shadow-raised"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-subtle">Your numbers · this month</p>
        <div className="mt-4 flex gap-2.5">
          {MY_SCORES.map((score, index) => (
            <motion.span
              key={score}
              initial={reduce ? false : { backgroundColor: "#1c1917" }}
              animate={MATCHED.has(score) ? { backgroundColor: "#c2410c", scale: [1, 1.12, 1] } : {}}
              transition={{ delay: drawDelay(DRAWN.indexOf(score)) + 0.2, duration: 0.5 }}
              className="tabular grid h-12 w-12 place-items-center rounded-full bg-ink font-[family-name:var(--font-display)] text-lg text-canvas sm:h-14 sm:w-14 sm:text-xl"
              style={{ zIndex: index }}
            >
              {score}
            </motion.span>
          ))}
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-ink-subtle">The draw</p>
        <div className="mt-3 flex gap-2.5">
          {DRAWN.map((number, index) => (
            <motion.span
              key={number}
              initial={reduce ? false : { opacity: 0, y: -24, rotate: -120 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: drawDelay(index), type: "spring", stiffness: 260, damping: 16 }}
              className={cn(
                "tabular grid h-10 w-10 place-items-center rounded-full text-sm ring-1 sm:h-11 sm:w-11",
                MATCHED.has(number) ? "bg-ember-wash text-ember-strong ring-ember/40" : "bg-canvas text-ink-muted ring-line-strong",
              )}
            >
              {number}
            </motion.span>
          ))}
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: drawDelay(DRAWN.length) + 0.3, type: "spring", stiffness: 300, damping: 18 }}
          className="mt-6 flex items-center gap-2 rounded-xl bg-ember px-4 py-3 text-sm font-medium text-white"
        >
          <Sparkles className="h-4 w-4" />
          3 numbers matched — a share of this month&apos;s prize
        </motion.div>
      </motion.div>
      <motion.div
        initial={reduce ? false : { opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: reduce ? 0 : 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -bottom-8 -left-4 flex max-w-[16rem] items-center gap-3 rounded-2xl border border-line bg-canvas-raised px-4 py-3 shadow-lift sm:-left-10"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-moss-soft text-moss"><HeartHandshake className="h-5 w-5" /></span>
        <span className="text-sm leading-snug text-ink"><strong>{charityShare}</strong> to {charityName} this month</span>
      </motion.div>
    </div>
  );
}
