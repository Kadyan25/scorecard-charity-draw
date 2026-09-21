import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { scoreInputSchema, userIdSchema } from "@/lib/validation";
import { adminAddScore } from "@/services/admin-member-actions";

type Context = { params: Promise<{ id: string }> };

export const POST = withErrors(async (request: Request, context: Context) => {
  const admin = await apiAdmin();
  const userId = userIdSchema.parse((await context.params).id);
  await adminAddScore(admin.userId, userId, await parseJson(request, scoreInputSchema));
  return NextResponse.json({ ok: true }, { status: 201 });
});
