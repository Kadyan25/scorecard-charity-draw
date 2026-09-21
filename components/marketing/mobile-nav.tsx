"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface Props {
  links: { href: string; label: string }[];
  account: { href: string; label: string } | null;
}

/** The main navigation below the md breakpoint, where the inline links are hidden. */
export function MobileNav({ links, account }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close whenever navigation happens, and let Escape close it too.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-canvas-sunken"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            aria-label="Main"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-16 border-b border-line bg-canvas px-4 pb-6 pt-2 shadow-lift"
          >
            <ul className="divide-y divide-line">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="block py-3.5 text-lg text-ink">{link.label}</Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-3">
              {account ? (
                <Link href={account.href} className={buttonVariants({ variant: "ink", className: "flex-1" })}>{account.label}</Link>
              ) : (
                <>
                  <Link href="/login" className={buttonVariants({ variant: "outline", className: "flex-1" })}>Sign in</Link>
                  <Link href="/signup" className={buttonVariants({ className: "flex-1" })}>Join now</Link>
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
