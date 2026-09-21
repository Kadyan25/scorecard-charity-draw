import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, HttpError, withErrors } from "@/lib/api";
import { submitProof } from "@/services/winner";

const fieldsSchema = z.object({ winnerId: z.string().uuid("That prize could not be found") });

// Winnings belong to the member whether or not they are still subscribed, so
// this needs a signed-in user, not an active subscription.
export const POST = withErrors(async (request: Request) => {
  const viewer = await apiUser();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "Send the screenshot as a file upload.");
  }
  const { winnerId } = fieldsSchema.parse({ winnerId: form.get("winnerId") });
  const file = form.get("proof");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a screenshot to upload.");

  await submitProof(viewer.userId, winnerId, file);
  return NextResponse.json({ ok: true });
});
