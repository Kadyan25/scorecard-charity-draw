import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Serif display against a clean grotesque body — editorial, not sporting.
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const body = Inter({
  variable: "--font-sans-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Digital Heroes — play a round, fund a cause",
    template: "%s · Digital Heroes",
  },
  description:
    "A subscription where your last five golf scores become your entry into the monthly draw, and part of every payment goes to a charity you choose.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-2.5 focus:text-canvas"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
