"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, label, exact = false }: { href: string; label: string; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-colors",
        active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-canvas-sunken hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}
