"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ContributionControl } from "@/components/charity/contribution-control";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/http";

export interface CharityOption {
  id: string;
  name: string;
  category: string;
}

interface Props {
  charities: CharityOption[];
  percentMin: number;
  percentMax: number;
  monthlyAmountCents: number;
  currency: string;
  initialCharityId?: string;
}

export function SignupForm(props: Props) {
  const router = useRouter();
  const [charityId, setCharityId] = useState(props.initialCharityId ?? "");
  const [percent, setPercent] = useState(props.percentMin);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await sendJson<{ needsConfirmation: boolean }>("/api/auth/signup", {
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      charityId,
      charityPercent: percent,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    if (result.data.needsConfirmation) {
      return setNotice("Check your inbox to confirm your email, then sign in.");
    }
    router.push("/subscribe");
    router.refresh();
  }

  if (notice) return <Alert tone="success">{notice}</Alert>;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <div>
        <Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="mt-1.5 text-xs text-ink-subtle">At least 8 characters.</p>
      </div>
      <div>
        <Label htmlFor="charityId">The cause you&apos;ll support</Label>
        <select
          id="charityId"
          value={charityId}
          onChange={(event) => setCharityId(event.target.value)}
          required
          className="h-11 w-full rounded-xl border border-line-strong bg-canvas-raised px-4 text-[0.95rem] text-ink focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
        >
          <option value="" disabled>Choose a charity…</option>
          {props.charities.map((charity) => (
            <option key={charity.id} value={charity.id}>
              {charity.name} — {charity.category}
            </option>
          ))}
        </select>
      </div>
      <ContributionControl
        value={percent}
        onChange={setPercent}
        min={props.percentMin}
        max={props.percentMax}
        monthlyAmountCents={props.monthlyAmountCents}
        currency={props.currency}
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending || !charityId}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
