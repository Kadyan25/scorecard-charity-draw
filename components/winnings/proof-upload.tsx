"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 4 * 1024 * 1024;

export function ProofUpload({ winnerId }: { winnerId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    // Checked again on the server; this just saves a pointless upload.
    if (chosen && chosen.size > MAX_BYTES) {
      setFile(null);
      setPreview(null);
      return setError("Screenshots must be 4 MB or smaller.");
    }
    setFile(chosen);
    setPreview(chosen ? URL.createObjectURL(chosen) : null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set("winnerId", winnerId);
    body.set("proof", file);
    try {
      const response = await fetch("/api/winners/proof", { method: "POST", body });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Upload failed.";
        return setError(message);
      }
      startTransition(() => router.refresh());
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong bg-canvas p-4 text-sm text-ink-muted transition-colors hover:border-ember">
        <Upload aria-hidden className="h-5 w-5 text-ember" />
        <span>{file ? file.name : "Choose a screenshot of your scores (PNG, JPEG or WebP, up to 4 MB)"}</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={choose} className="sr-only" />
      </label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={preview} alt="Preview of your screenshot" className="max-h-48 rounded-lg border border-line" />
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" size="sm" disabled={!file || pending}>{pending ? "Uploading…" : "Submit proof"}</Button>
    </form>
  );
}
