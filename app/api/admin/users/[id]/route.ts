import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { adminProfileSchema, userIdSchema } from "@/lib/validation";
import { updateMemberProfile } from "@/services/admin-member-actions";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withErrors(async (request: Request, context: Context) => {
  const admin = await apiAdmin();
  const userId = userIdSchema.parse((await context.params).id);
  await updateMemberProfile(admin.userId, userId, await parseJson(request, adminProfileSchema));
  return NextResponse.json({ ok: true });
});
