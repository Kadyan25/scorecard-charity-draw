import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { charityEventSchema, recordIdSchema } from "@/lib/validation";
import { addCharityEvent } from "@/services/admin-charities";

type Context = { params: Promise<{ id: string }> };

export const POST = withErrors(async (request: Request, context: Context) => {
  const admin = await apiAdmin();
  const id = recordIdSchema.parse((await context.params).id);
  await addCharityEvent(admin.userId, id, await parseJson(request, charityEventSchema));
  return NextResponse.json({ ok: true }, { status: 201 });
});
