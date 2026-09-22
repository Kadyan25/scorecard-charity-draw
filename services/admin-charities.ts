import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { HttpError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CharityEventRow, CharityRow } from "@/lib/supabase/types";
import type { AdminCharityInput, CharityEventInput } from "@/lib/validation";
import { slugify } from "@/services/charity-rules";
import { detectImageType, MAX_PROOF_BYTES } from "@/services/winner-rules";

/** Charity management: add, edit and delete charities, plus content and media. */

const MEDIA_BUCKET = "charity-media";

export interface AdminCharityRow extends CharityRow {
  supporters: number;
  donations: number;
}

export async function listAllCharities(): Promise<AdminCharityRow[]> {
  const admin = createSupabaseAdminClient();
  const [charities, profiles, donations] = await Promise.all([
    admin.from("charities").select("*").order("name"),
    admin.from("profiles").select("charity_id").not("charity_id", "is", null),
    admin.from("donations").select("charity_id"),
  ]);
  for (const result of [charities, profiles, donations]) {
    if (result.error) throw new Error(`Could not load charities: ${result.error.message}`);
  }
  const count = (rows: { charity_id: string | null }[], id: string) => rows.filter((row) => row.charity_id === id).length;
  return (charities.data ?? []).map((charity) => ({
    ...charity,
    supporters: count(profiles.data ?? [], charity.id),
    donations: count(donations.data ?? [], charity.id),
  }));
}

export async function getCharityForAdmin(id: string): Promise<{ charity: CharityRow; events: CharityEventRow[] } | null> {
  const admin = createSupabaseAdminClient();
  const { data: charity, error } = await admin.from("charities").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load charity: ${error.message}`);
  if (!charity) return null;
  const { data: events, error: eventsError } = await admin
    .from("charity_events")
    .select("*")
    .eq("charity_id", id)
    .order("event_date");
  if (eventsError) throw new Error(`Could not load events: ${eventsError.message}`);
  return { charity, events: events ?? [] };
}

function toColumns(input: AdminCharityInput) {
  return {
    name: input.name,
    slug: input.slug || slugify(input.name),
    tagline: input.tagline ?? null,
    description: input.description,
    mission: input.mission ?? null,
    category: input.category,
    website_url: input.websiteUrl || null,
    is_featured: input.isFeatured,
    is_active: input.isActive,
  };
}

function writeError(error: PostgrestError): never {
  if (error.code === "23505") throw new HttpError(409, "Another charity already uses that web address (slug).");
  throw new Error(`Could not save charity: ${error.message}`);
}

export async function createCharity(adminId: string, input: AdminCharityInput): Promise<string> {
  const { data, error } = await createSupabaseAdminClient().from("charities").insert(toColumns(input)).select("id").single();
  if (error) writeError(error);
  await recordAudit({ actorId: adminId, action: "charity.created", entity: "charity", entityId: data.id, meta: { name: input.name } });
  return data.id;
}

export async function updateCharity(adminId: string, id: string, input: AdminCharityInput): Promise<void> {
  const { data, error } = await createSupabaseAdminClient().from("charities").update(toColumns(input)).eq("id", id).select("id");
  if (error) writeError(error);
  if (!data?.length) throw new HttpError(404, "That charity could not be found.");
  await recordAudit({ actorId: adminId, action: "charity.updated", entity: "charity", entityId: id, meta: { name: input.name } });
}

/**
 * Hard delete only when nothing depends on the charity. One that members
 * support or that has received donations is deactivated instead: deleting it
 * would silently remove members' choice and orphan donation history.
 */
export async function deleteCharity(adminId: string, id: string): Promise<void> {
  const charity = (await listAllCharities()).find((row) => row.id === id);
  if (!charity) throw new HttpError(404, "That charity could not be found.");
  if (charity.supporters > 0 || charity.donations > 0) {
    throw new HttpError(
      409,
      `${charity.name} has ${charity.supporters} supporters and ${charity.donations} donations. Deactivate it instead so that history is kept.`,
    );
  }
  const { error } = await createSupabaseAdminClient().from("charities").delete().eq("id", id);
  if (error) throw new Error(`Could not delete charity: ${error.message}`);
  // Photos are not covered by the row's cascade; remove them too.
  await removeMediaFolder(id);
  await recordAudit({ actorId: adminId, action: "charity.deleted", entity: "charity", entityId: id, meta: { name: charity.name } });
}

/**
 * Migration 0009 creates the bucket; this repairs the case where it exists but
 * is not yet public (a fresh local stack) or is missing entirely.
 */
async function ensureMediaBucket(): Promise<void> {
  const storage = createSupabaseAdminClient().storage;
  const { data } = await storage.getBucket(MEDIA_BUCKET);
  if (data?.public) return;
  const { error } = data
    ? await storage.updateBucket(MEDIA_BUCKET, { public: true })
    : await storage.createBucket(MEDIA_BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) throw new Error(`Could not prepare media bucket: ${error.message}`);
}

async function removeMediaFolder(charityId: string): Promise<void> {
  const storage = createSupabaseAdminClient().storage.from(MEDIA_BUCKET);
  const { data, error } = await storage.list(charityId);
  if (error) throw new Error(`Could not list charity media: ${error.message}`);
  if (data?.length) await storage.remove(data.map((file) => `${charityId}/${file.name}`));
}

export async function uploadCharityImage(adminId: string, id: string, file: File): Promise<string> {
  if (file.size === 0 || file.size > MAX_PROOF_BYTES) throw new HttpError(400, "Images must be under 4 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) throw new HttpError(400, "Please upload a PNG, JPEG or WebP image.");
  const existing = await getCharityForAdmin(id);
  if (!existing) throw new HttpError(404, "That charity could not be found.");

  await ensureMediaBucket();
  const storage = createSupabaseAdminClient().storage.from(MEDIA_BUCKET);
  const path = `${id}/hero-${Date.now()}.${type.ext}`;
  const { error } = await storage.upload(path, bytes, { contentType: type.contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const url = storage.getPublicUrl(path).data.publicUrl;

  const { error: saveError } = await createSupabaseAdminClient().from("charities").update({ hero_image_url: url }).eq("id", id);
  if (saveError) {
    await storage.remove([path]);
    throw new Error(`Could not save image: ${saveError.message}`);
  }
  const previous = existing.charity.hero_image_url?.split(`/${MEDIA_BUCKET}/`)[1];
  if (previous) await storage.remove([previous]);
  await recordAudit({ actorId: adminId, action: "charity.image_updated", entity: "charity", entityId: id });
  return url;
}

export async function addCharityEvent(adminId: string, charityId: string, input: CharityEventInput): Promise<void> {
  const { error } = await createSupabaseAdminClient().from("charity_events").insert({
    charity_id: charityId,
    title: input.title,
    description: input.description ?? null,
    event_date: input.eventDate,
    location: input.location ?? null,
  });
  if (error?.code === "23503") throw new HttpError(404, "That charity could not be found.");
  if (error) throw new Error(`Could not add event: ${error.message}`);
  await recordAudit({ actorId: adminId, action: "charity.event_added", entity: "charity", entityId: charityId, meta: { title: input.title } });
}

export async function deleteCharityEvent(adminId: string, eventId: string): Promise<void> {
  const { data, error } = await createSupabaseAdminClient()
    .from("charity_events")
    .delete()
    .eq("id", eventId)
    .select("charity_id, title");
  if (error) throw new Error(`Could not delete event: ${error.message}`);
  if (!data?.length) throw new HttpError(404, "That event could not be found.");
  await recordAudit({ actorId: adminId, action: "charity.event_deleted", entity: "charity", entityId: data[0].charity_id, meta: { title: data[0].title } });
}
