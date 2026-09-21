import { HeartHandshake } from "lucide-react";
import { coverThemeFor, initialsFor } from "@/services/charity-rules";
import type { CharityRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * A charity's own photography when it has some; otherwise a designed cover in
 * the platform palette, so a missing image never looks like a broken one.
 */
export function CharityCover({
  charity,
  className,
  size = "md",
}: {
  charity: Pick<CharityRow, "name" | "slug" | "hero_image_url" | "category">;
  className?: string;
  size?: "md" | "lg";
}) {
  if (charity.hero_image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URLs from arbitrary hosts
      <img src={charity.hero_image_url} alt="" className={cn("h-full w-full object-cover", className)} loading="lazy" />
    );
  }

  const theme = coverThemeFor(charity.slug);
  return (
    <div aria-hidden className={cn("relative h-full w-full overflow-hidden", className)} style={{ background: theme.gradient }}>
      <HeartHandshake className="absolute -bottom-6 -right-6 h-40 w-40 opacity-15" style={{ color: theme.accent }} />
      <span
        className={cn(
          "absolute left-6 top-5 font-[family-name:var(--font-display)] tracking-tight",
          size === "lg" ? "text-8xl" : "text-5xl",
        )}
        style={{ color: theme.accent, opacity: 0.9 }}
      >
        {initialsFor(charity.name)}
      </span>
    </div>
  );
}
