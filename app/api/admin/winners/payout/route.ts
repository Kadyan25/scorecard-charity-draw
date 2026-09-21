import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { winnerPayoutSchema } from "@/lib/validation";
import { markPaid } from "@/services/winner";

export const POST = withErrors(async (request: Request) => {
  const admin = await apiAdmin();
  const { winnerId } = await parseJson(request, winnerPayoutSchema);
  await markPaid(admin.userId, winnerId);
  return NextResponse.json({ ok: true });
});
