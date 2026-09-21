"use client";

/**
 * Last-resort boundary for failures in the root layout itself, where the app's
 * fonts and styles may not have loaded — so it carries its own minimal styling.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Georgia, serif", background: "#faf6f0", color: "#1c1917" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: "2rem" }}>
          <div>
            <h1 style={{ fontWeight: 400, fontSize: "2.25rem" }}>Digital Heroes is having a moment.</h1>
            <p style={{ color: "#57534e" }}>Please try again in a few seconds.</p>
            <button
              onClick={reset}
              style={{ marginTop: "1.5rem", padding: "0.75rem 1.75rem", borderRadius: 999, border: 0, background: "#c2410c", color: "#fff", fontSize: "1rem", cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
