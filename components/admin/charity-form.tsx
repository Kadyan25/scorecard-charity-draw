"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/http";
import { slugify } from "@/services/charity-rules";

export interface CharityFormValues {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  mission: string;
  category: string;
  websiteUrl: string;
  isFeatured: boolean;
  isActive: boolean;
}

const textareaClass =
  "w-full rounded-xl border border-line-strong bg-canvas-raised px-4 py-3 text-[0.95rem] text-ink placeholder:text-ink-subtle focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20";

export function CharityForm({ initial, categories }: { initial: CharityFormValues; categories: string[] }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const set = <K extends keyof CharityFormValues>(key: K, value: CharityFormValues[K]) =>
    setValues((current) => ({
      ...current,
      [key]: value,
      // Keep the slug following the name until someone edits it by hand.
      ...(key === "name" && !slugTouched && { slug: slugify(String(value)) }),
    }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const { id, ...body } = values;

    if (!id) {
      const created = await sendJson<{ id: string }>("/api/admin/charities", body);
      setPending(false);
      if (!created.ok) return setMessage({ tone: "error", text: created.error });
      return router.push(`/admin/charities/${created.data.id}`);
    }

    const updated = await sendJson(`/api/admin/charities/${id}`, body, "PATCH");
    setPending(false);
    if (!updated.ok) return setMessage({ tone: "error", text: updated.error });
    setMessage({ tone: "success", text: "Charity saved." });
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="charity-name">Name</Label>
          <Input id="charity-name" value={values.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="charity-slug">Web address</Label>
          <Input id="charity-slug" value={values.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} />
          <p className="mt-1 text-xs text-ink-subtle">/charities/{values.slug || "…"}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="charity-category">Category</Label>
          <Input id="charity-category" list="charity-categories" value={values.category} onChange={(e) => set("category", e.target.value)} />
          <datalist id="charity-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
        </div>
        <div>
          <Label htmlFor="charity-website">Website</Label>
          <Input id="charity-website" type="url" placeholder="https://" value={values.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="charity-tagline">Tagline</Label>
        <Input id="charity-tagline" maxLength={200} value={values.tagline} onChange={(e) => set("tagline", e.target.value)} />
      </div>
      <div>
        <Label htmlFor="charity-description">Description</Label>
        <textarea id="charity-description" rows={5} className={textareaClass} value={values.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div>
        <Label htmlFor="charity-mission">Mission statement</Label>
        <textarea id="charity-mission" rows={2} className={textareaClass} value={values.mission} onChange={(e) => set("mission", e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-6 text-sm text-ink">
        <label className="flex items-center gap-2"><input type="checkbox" checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-[var(--color-ember)]" /> Listed publicly</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={values.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} className="h-4 w-4 accent-[var(--color-ember)]" /> Featured on the homepage</label>
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : values.id ? "Save changes" : "Create charity"}</Button>
    </form>
  );
}
