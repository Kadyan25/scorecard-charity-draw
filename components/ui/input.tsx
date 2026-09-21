import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-line-strong bg-canvas-raised px-4 text-[0.95rem] text-ink placeholder:text-ink-subtle transition-colors focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20 disabled:opacity-60 aria-[invalid=true]:border-rose",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
