/**
 * Client-side JSON helper for calling our own route handlers. Always resolves —
 * failures come back as a readable message rather than a thrown error, so every
 * form handles them explicitly.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function sendJson<T>(
  url: string,
  body?: unknown,
  method: "POST" | "PATCH" | "DELETE" | "PUT" = "POST",
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : `Request failed (${response.status})`;
      return { ok: false, error: message };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Check your connection and try again." };
  }
}
