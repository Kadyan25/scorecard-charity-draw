import { Wordmark } from "@/components/marketing/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-canvas lg:flex lg:flex-col lg:justify-between">
        <Wordmark className="text-canvas" />
        <div className="relative z-10 max-w-md">
          <p className="font-[family-name:var(--font-display)] text-4xl leading-tight">
            Your five best rounds, working for something bigger than your handicap.
          </p>
          <p className="mt-5 text-canvas/70">
            Log your scores, enter the monthly draw, and send part of every payment to a
            cause you believe in.
          </p>
        </div>
        <div
          aria-hidden
          className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-ember/40 blur-3xl"
        />
      </aside>
      <main id="main" className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Wordmark />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
