import { NextResponse } from "next/server";
import { parseJson, withErrors } from "@/lib/api";
import { signUpSchema } from "@/lib/validation";
import { signUp } from "@/services/account";

export const POST = withErrors(async (request: Request) => {
  const input = await parseJson(request, signUpSchema);
  const result = await signUp(input);
  return NextResponse.json(result, { status: 201 });
});
