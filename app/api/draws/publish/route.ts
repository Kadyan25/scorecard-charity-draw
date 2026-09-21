import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { drawPublishSchema } from "@/lib/validation";
import { publishDraw } from "@/services/draw-admin";

export const POST = withErrors(async (request: Request) => {
  const admin = await apiAdmin();
  const { drawId } = await parseJson(request, drawPublishSchema);
  await publishDraw(drawId, admin.userId);
  return NextResponse.json({ ok: true });
});
