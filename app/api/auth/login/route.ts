import { NextResponse } from "next/server";
import { parseJson, withErrors } from "@/lib/api";
import { signInSchema } from "@/lib/validation";
import { signIn } from "@/services/account";

export const POST = withErrors(async (request: Request) => {
  const { email, password } = await parseJson(request, signInSchema);
  await signIn(email, password);
  return NextResponse.json({ ok: true });
});
