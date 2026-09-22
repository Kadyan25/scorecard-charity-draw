import { NextResponse } from "next/server";
import { apiUser, parseJson, withErrors } from "@/lib/api";
import { profileUpdateSchema } from "@/lib/validation";
import { updateMyProfile } from "@/services/account";

// Open to any signed-in member, subscribed or not: a name is part of the
// account, not of the membership.
export const PATCH = withErrors(async (request: Request) => {
  const viewer = await apiUser();
  const input = await parseJson(request, profileUpdateSchema);
  await updateMyProfile(viewer.userId, input);
  return NextResponse.json({ ok: true });
});
