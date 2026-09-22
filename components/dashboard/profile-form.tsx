"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/http";

export function ProfileForm({ fullName: initial, email }: { fullName: string; email: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await sendJson("/api/profile", { fullName }, "PATCH");
    setPending(false);
    if (!result.ok) return setMessage({ tone: "error", text: result.error });
    setMessage({ tone: "success", text: "Profile saved." });
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="profile-name">Full name</Label>
        <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
      </div>
      <div>
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={email} disabled readOnly />
        <p className="mt-1.5 text-sm text-ink-muted">Your email is how you sign in, and cannot be changed here.</p>
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}
