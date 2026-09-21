import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-4xl text-ink">Welcome back</h1>
      <p className="mb-8 mt-2 text-ink-muted">Sign in to log scores and check this month&apos;s draw.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-8 text-sm text-ink-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ember hover:text-ember-strong">
          Create an account
        </Link>
      </p>
    </>
  );
}
