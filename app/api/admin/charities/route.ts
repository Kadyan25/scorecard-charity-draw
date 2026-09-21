import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { adminCharitySchema } from "@/lib/validation";
import { createCharity } from "@/services/admin-charities";

export const POST = withErrors(async (request: Request) => {
  const admin = await apiAdmin();
  const id = await createCharity(admin.userId, await parseJson(request, adminCharitySchema));
  return NextResponse.json({ id }, { status: 201 });
});
