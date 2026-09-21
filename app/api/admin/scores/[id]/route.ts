import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { scoreIdSchema, scoreUpdateSchema } from "@/lib/validation";
import { adminDeleteScore, adminUpdateScore } from "@/services/admin-member-actions";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withErrors(async (request: Request, context: Context) => {
  const admin = await apiAdmin();
  const scoreId = scoreIdSchema.parse((await context.params).id);
  await adminUpdateScore(admin.userId, scoreId, await parseJson(request, scoreUpdateSchema));
  return NextResponse.json({ ok: true });
});

export const DELETE = withErrors(async (_request: Request, context: Context) => {
  const admin = await apiAdmin();
  const scoreId = scoreIdSchema.parse((await context.params).id);
  await adminDeleteScore(admin.userId, scoreId);
  return NextResponse.json({ ok: true });
});
