import Link from "next/link";
import { cn } from "@/lib/utils";

export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "font-[family-name:var(--font-display)] text-xl tracking-tight text-ink",
        className,
      )}
      aria-label="Digital Heroes home"
    >
      digital heroes<span className="text-ember">.</span>
    </Link>
  );
}
