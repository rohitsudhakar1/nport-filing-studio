import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Type system, chosen from the subject's own world:
// - Newsreader: editorial serif for display — the voice of a printed prospectus.
// - Public Sans: the U.S. government's official typeface (USWDS), for a tool that
//   produces U.S. government filings.
// - IBM Plex Mono: all data — EDGAR filings render in monospace.
const display = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});
const sans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "N-PORT Filing Studio",
  description:
    "ETF operations as software: ingest real fund data, validate against SEC Form N-PORT rules, review with a full audit trail, and produce EDGAR-ready filings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <header className="masthead sticky top-0 z-10">
          <div className="mx-auto max-w-[1180px] px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="font-display text-[1.35rem] font-medium tracking-tight leading-none">
                N-PORT Filing Studio
              </span>
              <span className="font-mono text-[0.62rem] tracking-[0.18em] uppercase text-faint">
                ETF ops · EDGAR-native
              </span>
            </Link>
            <nav className="flex items-center gap-6 font-mono text-[0.72rem] tracking-[0.08em] uppercase text-muted">
              <Link href="/" className="hover:text-ink">
                Filings
              </Link>
              <Link href="/funds/CORG" className="hover:text-ink">
                Fund pages
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1180px] px-6 py-9">{children}</main>
        <footer className="mx-auto max-w-[1180px] px-6 pt-4 pb-10">
          <div className="border-t-2 border-double pt-4 font-mono text-[0.68rem] text-faint leading-relaxed">
            Built for Corgi — ETF operations as software. Reads live SEC EDGAR data; produces a
            Form N-PORT Part C subset. Demonstration only — not an official SEC submission tool,
            not investment advice.
          </div>
        </footer>
      </body>
    </html>
  );
}
