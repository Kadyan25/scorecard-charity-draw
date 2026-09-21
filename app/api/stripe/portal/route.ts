import { NextResponse } from "next/server";
import { apiUser, withErrors } from "@/lib/api";
import { createPortalSession } from "@/services/checkout";

export const POST = withErrors(async () => {
  const viewer = await apiUser();
  return NextResponse.json({ url: await createPortalSession(viewer.userId) });
});
