import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Shown in place of subscriber-only features (PRD section 04, access control). */
export function LockedFeature({ title, body }: { title: string; body: string }) {
  return (
    <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ember-wash text-ember">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <div className="flex-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">{body}</p>
      </div>
      <Link href="/subscribe" className={buttonVariants({ size: "sm" })}>See plans</Link>
    </Card>
  );
}
