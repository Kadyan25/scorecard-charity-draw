import { NextResponse } from "next/server";
import { apiSubscriber, parseJson, withErrors } from "@/lib/api";
import { scoreIdSchema, scoreUpdateSchema } from "@/lib/validation";
import { deleteScore, updateScore } from "@/services/score";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withErrors(async (request: Request, context: Context) => {
  const viewer = await apiSubscriber();
  const id = scoreIdSchema.parse((await context.params).id);
  const patch = await parseJson(request, scoreUpdateSchema);
  return NextResponse.json({ score: await updateScore(viewer.userId, id, patch) });
});

export const DELETE = withErrors(async (_request: Request, context: Context) => {
  const viewer = await apiSubscriber();
  const id = scoreIdSchema.parse((await context.params).id);
  await deleteScore(viewer.userId, id);
  return NextResponse.json({ ok: true });
});
