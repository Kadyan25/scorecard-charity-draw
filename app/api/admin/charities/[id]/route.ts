import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { adminCharitySchema, recordIdSchema } from "@/lib/validation";
import { deleteCharity, updateCharity } from "@/services/admin-charities";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withErrors(async (request: Request, context: Context) => {
  const admin = await apiAdmin();
  const id = recordIdSchema.parse((await context.params).id);
  await updateCharity(admin.userId, id, await parseJson(request, adminCharitySchema));
  return NextResponse.json({ ok: true });
});

export const DELETE = withErrors(async (_request: Request, context: Context) => {
  const admin = await apiAdmin();
  await deleteCharity(admin.userId, recordIdSchema.parse((await context.params).id));
  return NextResponse.json({ ok: true });
});
