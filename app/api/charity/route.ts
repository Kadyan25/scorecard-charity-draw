import { NextResponse } from "next/server";
import { apiUser, parseJson, withErrors } from "@/lib/api";
import { charitySelectionSchema } from "@/lib/validation";
import { updateMyCharity } from "@/services/charity";

// Any signed-in member may change their cause, subscribed or not: the choice is
// part of their profile from signup onwards.
export const PATCH = withErrors(async (request: Request) => {
  const viewer = await apiUser();
  const selection = await parseJson(request, charitySelectionSchema);
  await updateMyCharity(viewer.userId, selection);
  return NextResponse.json({ ok: true });
});
