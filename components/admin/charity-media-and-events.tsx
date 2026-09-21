"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Trash2, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendJson } from "@/lib/http";

function useRefresh() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return { router, refresh: () => startTransition(() => router.refresh()) };
}

export function CharityImageUpload({ charityId }: { charityId: string }) {
  const { refresh } = useRefresh();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set("image", file);
    try {
      const response = await fetch(`/api/admin/charities/${charityId}/image`, { method: "POST", body });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Upload failed.");
      } else {
        refresh();
      }
    } catch {
      setError("We couldn't reach the server. Try again.");
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 text-sm text-ink-muted hover:border-ember">
        <Upload aria-hidden className="h-5 w-5 text-ember" />
        {pending ? "Uploading…" : "Upload a cover photo (PNG, JPEG or WebP, up to 4 MB)"}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={pending} className="sr-only" />
      </label>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

interface EventItem {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
}

export function CharityEventsManager({ charityId, events }: { charityId: string; events: EventItem[] }) {
  const { refresh } = useRefresh();
  const [draft, setDraft] = useState({ title: "", eventDate: "", location: "", description: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await sendJson(`/api/admin/charities/${charityId}/events`, draft);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setDraft({ title: "", eventDate: "", location: "", description: "" });
    refresh();
  }

  async function remove(id: string) {
    const result = await sendJson(`/api/admin/charity-events/${id}`, undefined, "DELETE");
    if (!result.ok) return setError(result.error);
    refresh();
  }

  return (
    <div className="space-y-5">
      {events.length === 0 ? (
        <p className="text-sm text-ink-muted">No events yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {events.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span><span className="text-ink">{item.title}</span><span className="block text-ink-muted">{format(parseISO(item.event_date), "d MMM yyyy")}{item.location && ` · ${item.location}`}</span></span>
              <Button size="sm" variant="ghost" onClick={() => remove(item.id)} aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2"><Label htmlFor="event-title">Event title</Label><Input id="event-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
        <div><Label htmlFor="event-date">Date</Label><Input id="event-date" type="date" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} /></div>
        <div><Label htmlFor="event-location">Location</Label><Input id="event-location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label htmlFor="event-description">Description</Label><Input id="event-description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
        {error && <Alert tone="error" className="sm:col-span-2">{error}</Alert>}
        <div><Button type="submit" size="sm" disabled={pending || !draft.title || !draft.eventDate}>{pending ? "Adding…" : "Add event"}</Button></div>
      </form>
    </div>
  );
}

export function DeleteCharityButton({ charityId, name }: { charityId: string; name: string }) {
  const { router } = useRefresh();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const result = await sendJson(`/api/admin/charities/${charityId}`, undefined, "DELETE");
    setPending(false);
    if (!result.ok) {
      setConfirming(false);
      return setError(result.error);
    }
    router.push("/admin/charities");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink">Permanently delete {name}?</span>
          <Button size="sm" variant="danger" onClick={remove} disabled={pending}>{pending ? "Deleting…" : "Delete"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>Keep</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>Delete charity</Button>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
