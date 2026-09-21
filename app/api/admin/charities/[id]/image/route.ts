import { NextResponse } from "next/server";
import { apiAdmin, HttpError, withErrors } from "@/lib/api";
import { recordIdSchema } from "@/lib/validation";
import { uploadCharityImage } from "@/services/admin-charities";

type Context = { params: Promise<{ id: string }> };

export const POST = withErrors(async (request: Request, context: Context) => {
  const admin = await apiAdmin();
  const id = recordIdSchema.parse((await context.params).id);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "Send the image as a file upload.");
  }
  const file = form.get("image");
  if (!(file instanceof File)) throw new HttpError(400, "Choose an image to upload.");
  return NextResponse.json({ url: await uploadCharityImage(admin.userId, id, file) });
});
