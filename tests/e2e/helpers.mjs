// Shared plumbing for the HTTP end-to-end suites.
import fs from "node:fs";

// E2E_ENV_FILE lets the same suites run against the deployed site (.env.cloud).
const envFile = process.env.E2E_ENV_FILE ?? ".env.local";

export const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

// Targets whichever origin the app is configured for, unless overridden.
export const BASE = process.env.E2E_BASE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

/** JSON API client bound to a session cookie ("" for a signed-out visitor). */
export function client(cookie) {
  return async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

/** Fetch a rendered page's HTML with React's text separators removed. */
export async function page(path, cookie = "") {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  return { status: res.status, html: (await res.text()).replaceAll("<!-- -->", "") };
}

export const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

export function createChecker(suite) {
  let failures = 0;
  return {
    check(label, condition, detail = "") {
      console.log(`${condition ? "PASS" : "FAIL"}  [${suite}] ${label}${condition ? "" : `  -> ${detail}`}`);
      if (!condition) failures += 1;
    },
    done() {
      console.log(failures === 0 ? `ALL ${suite.toUpperCase()} SCENARIOS PASSED\n` : `${failures} ${suite} FAILED\n`);
      return failures;
    },
  };
}
