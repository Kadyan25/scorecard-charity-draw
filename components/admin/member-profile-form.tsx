"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/http";

interface Props {
  userId: string;
  fullName: string;
  charityId: string | null;
  charityPercent: number;
  charities: { id: string; name: string }[];
  percentMin: number;
  percentMax: number;
}

export function MemberProfileForm(props: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(props.fullName);
  const [charityId, setCharityId] = useState(props.charityId ?? "");
  const [percent, setPercent] = useState(String(props.charityPercent));
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await sendJson(`/api/admin/users/${props.userId}`, { fullName, charityId, charityPercent: Number(percent) }, "PATCH");
    setPending(false);
    if (!result.ok) return setMessage({ tone: "error", text: result.error });
    setMessage({ tone: "success", text: "Member updated." });
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="member-name">Full name</Label>
        <Input id="member-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <Label htmlFor="member-charity">Charity</Label>
          <select id="member-charity" value={charityId} onChange={(e) => setCharityId(e.target.value)} className="h-11 w-full rounded-xl border border-line-strong bg-canvas-raised px-4 text-[0.95rem] text-ink focus:border-ember focus:outline-none">
            <option value="" disabled>Choose…</option>
            {props.charities.map((charity) => <option key={charity.id} value={charity.id}>{charity.name}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="member-percent">Contribution %</Label>
          <Input id="member-percent" type="number" min={props.percentMin} max={props.percentMax} value={percent} onChange={(e) => setPercent(e.target.value)} className="tabular" />
        </div>
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}
