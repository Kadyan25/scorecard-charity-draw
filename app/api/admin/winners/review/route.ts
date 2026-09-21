import { NextResponse } from "next/server";
import { apiAdmin, parseJson, withErrors } from "@/lib/api";
import { winnerReviewSchema } from "@/lib/validation";
import { reviewWinner } from "@/services/winner";

export const POST = withErrors(async (request: Request) => {
  const admin = await apiAdmin();
  const { winnerId, decision, note } = await parseJson(request, winnerReviewSchema);
  await reviewWinner(admin.userId, winnerId, decision, note);
  return NextResponse.json({ ok: true });
});
