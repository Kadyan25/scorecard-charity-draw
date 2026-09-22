import { NextResponse } from "next/server";
import { apiOptionalUser, parseJson, withErrors } from "@/lib/api";
import { donationSchema } from "@/lib/validation";
import { createDonationCheckout } from "@/services/donation";

// Open to visitors: giving is deliberately not tied to membership.
export const POST = withErrors(async (request: Request) => {
  const { charityId, amountCents } = await parseJson(request, donationSchema);
  const url = await createDonationCheckout(await apiOptionalUser(), charityId, amountCents);
  return NextResponse.json({ url });
});
