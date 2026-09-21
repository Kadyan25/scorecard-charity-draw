import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "error" | "success";

const toneClass: Record<Tone, string> = {
  info: "border-line-strong bg-canvas-sunken text-ink",
  error: "border-rose/30 bg-rose-soft text-rose",
  success: "border-moss/30 bg-moss-soft text-moss",
};

export function Alert({
  tone = "info",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-xl border px-4 py-3 text-sm", toneClass[tone], className)}
      {...props}
    />
  );
}
