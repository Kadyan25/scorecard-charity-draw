import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { adminSettingsSchema } from "@/lib/validation";
import { updateSettings } from "@/services/admin-settings";

export const PATCH = withErrors(async (request: Request) => {
  const admin = await apiAdmin();
  await updateSettings(admin.userId, await parseJson(request, adminSettingsSchema));
  return NextResponse.json({ ok: true });
});
