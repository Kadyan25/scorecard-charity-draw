import { NextResponse } from "next/server";
import { withErrors } from "@/lib/api";
import { signOut } from "@/services/account";

export const POST = withErrors(async () => {
  await signOut();
  return NextResponse.json({ ok: true });
});
