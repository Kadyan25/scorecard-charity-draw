import "server-only";

import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAccess } from "@/lib/auth";

/**
 * Route-handler plumbing. Page guards in lib/auth.ts redirect; API callers need
 * a status code and a JSON body instead, so the two are kept separate.
 */

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ApiViewer {
  userId: string;
  role: "user" | "admin";
}

export async function apiUser(): Promise<ApiViewer> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Please sign in to continue.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profileError || !profile) throw new HttpError(403, "Account profile not found.");

  return { userId: data.user.id, role: profile.role };
}

export async function apiSubscriber(): Promise<ApiViewer> {
  const viewer = await apiUser();
  const access = await loadAccess(viewer.userId);
  if (!access.hasAccess) {
    throw new HttpError(402, "An active subscription is required for this.");
  }
  return viewer;
}

export async function apiAdmin(): Promise<ApiViewer> {
  const viewer = await apiUser();
  if (viewer.role !== "admin") throw new HttpError(403, "Admin access required.");
  return viewer;
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

/** Maps known failures to clean responses; anything else is a logged 500. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json(
      { error: message, issues: error.issues },
      { status: 400 },
    );
  }
  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: "Something went wrong on our side. Please try again." },
    { status: 500 },
  );
}

export function withErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
