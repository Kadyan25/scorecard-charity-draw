import { NextResponse } from "next/server";
import { apiUser, parseJson, withErrors } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation";
import { createCheckoutSession } from "@/services/checkout";

export const POST = withErrors(async (request: Request) => {
  const viewer = await apiUser();
  const { planCode } = await parseJson(request, checkoutSchema);
  const url = await createCheckoutSession(viewer.userId, planCode);
  return NextResponse.json({ url });
});
