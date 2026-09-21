import { NextResponse } from "next/server";
import { apiAdmin, withErrors } from "@/lib/api";
import { recordIdSchema } from "@/lib/validation";
import { deleteCharityEvent } from "@/services/admin-charities";

type Context = { params: Promise<{ id: string }> };

export const DELETE = withErrors(async (_request: Request, context: Context) => {
  const admin = await apiAdmin();
  await deleteCharityEvent(admin.userId, recordIdSchema.parse((await context.params).id));
  return NextResponse.json({ ok: true });
});
