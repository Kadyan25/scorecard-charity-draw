import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { adminSubscriptionActionSchema, userIdSchema } from "@/lib/validation";
import { manageSubscription } from "@/services/admin-member-actions";

type Context = { params: Promise<{ id: string }> };

export const POST = withErrors(async (request: Request, context: Context) => {
  const admin = await apiAdmin();
  const userId = userIdSchema.parse((await context.params).id);
  const { action } = await parseJson(request, adminSubscriptionActionSchema);
  await manageSubscription(admin.userId, userId, action);
  return NextResponse.json({ ok: true });
});
