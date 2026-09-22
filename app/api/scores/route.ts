import { NextResponse } from "next/server";
import { apiSubscriber, parseJson, withErrors } from "@/lib/api";
import { scoreInputSchema } from "@/lib/validation";
import { addScore, listScores } from "@/services/score";

// Score entry is a subscriber feature; the guard re-checks the
// subscription on every request rather than trusting an earlier page load.
export const GET = withErrors(async () => {
  const viewer = await apiSubscriber();
  return NextResponse.json({ scores: await listScores(viewer.userId) });
});

export const POST = withErrors(async (request: Request) => {
  const viewer = await apiSubscriber();
  const input = await parseJson(request, scoreInputSchema);
  return NextResponse.json({ score: await addScore(viewer.userId, input) }, { status: 201 });
});
