import { NextResponse } from "next/server";
import { apiUser, parseJson, withErrors } from "@/lib/api";
import { passwordChangeSchema } from "@/lib/validation";
import { changeMyPassword } from "@/services/account";

// The account acted on is always the session's own; nothing identifying a user
// is read from the request body.
export const POST = withErrors(async (request: Request) => {
  await apiUser();
  const input = await parseJson(request, passwordChangeSchema);
  await changeMyPassword(input);
  return NextResponse.json({ ok: true });
});
