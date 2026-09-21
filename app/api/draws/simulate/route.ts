import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { drawSimulateSchema } from "@/lib/validation";
import { simulateDraw } from "@/services/draw-admin";
import { periodFromMonthInput } from "@/services/draw-engine";

export const POST = withErrors(async (request: Request) => {
  const admin = await apiAdmin();
  const { month, mode } = await parseJson(request, drawSimulateSchema);
  const drawId = await simulateDraw(periodFromMonthInput(month), mode, admin.userId);
  return NextResponse.json({ drawId }, { status: 201 });
});
