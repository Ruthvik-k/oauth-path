import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "OAuth Path: setup & approval guides for agent builders", template: "%s · OAuth Path" },
  description:
    "Know how hard it is to get your OAuth app approved before you start: time, effort, requirements, blockers, and what an agent can do for you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-600 text-sm text-white">⇢</span>
              OAuth Path
            </Link>
            <nav className="flex items-center gap-0.5 whitespace-nowrap text-sm text-slate-600 sm:gap-1">
              <Link href="/#library" className="rounded px-2 py-1 hover:bg-slate-100 hover:text-slate-900">
                Library
              </Link>
              <Link href="/verification" className="rounded px-2 py-1 hover:bg-slate-100 hover:text-slate-900">
                Verification
              </Link>
              <Link href="/about" className="rounded px-2 py-1 hover:bg-slate-100 hover:text-slate-900">
                How it works
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500">
            Guides summarize provider documentation and our own setup attempts. Each claim has an evidence label and source. Providers
            change their rules, so check the &ldquo;last checked&rdquo; date before you rely on a guide.
          </div>
        </footer>
      </body>
    </html>
  );
}
