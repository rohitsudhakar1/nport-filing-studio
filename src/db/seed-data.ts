import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, exceptions, filings, funds, holdings } from "@/db/schema";
import type { AssetCategory, Holding, IssuerCategory } from "@/lib/types";
import { summarizeFindings, validateHoldings } from "@/lib/validators/nport-rules";

/** Run validation for a filing and persist exceptions + counts (mirrors the app ingest path). */
async function persistValidation(filingId: number, hs: Holding[]) {
  const findings = validateHoldings(hs);
  if (findings.length > 0) {
    await db.insert(exceptions).values(
      findings.map((f) => ({
        filingId,
        code: f.code,
        severity: f.severity,
        message: f.message,
        holdingRow: f.holdingRow,
        field: f.field,
        status: "open" as const,
      })),
    );
  }
  const s = summarizeFindings(findings);
  await db
    .update(filings)
    .set({ errorCount: s.errors, warningCount: s.warnings })
    .where(eq(filings.id, filingId));
}

// Compute a valid CUSIP check digit for a real 8-char stem so seeded holdings pass
// validation (the stems below are real; only the one deliberate defect is corrupted).
function withCheck(stem8: string): string {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const c = stem8[i];
    let v =
      c >= "0" && c <= "9" ? c.charCodeAt(0) - 48 : c >= "A" && c <= "Z" ? c.charCodeAt(0) - 55 : 0;
    if (i % 2 === 1) v *= 2;
    sum += Math.floor(v / 10) + (v % 10);
  }
  return stem8 + ((10 - (sum % 10)) % 10);
}

interface Seed {
  name: string;
  title: string;
  stem: string;
  ticker: string;
  sector: string;
  pct: number;
  ac?: AssetCategory;
  ic?: IssuerCategory;
}

// Prior month (approved) — a clean, tech-heavy US equity ETF.
const PRIOR: Seed[] = [
  { name: "Apple Inc", title: "Apple Inc Common Stock", stem: "03783310", ticker: "AAPL", sector: "Information Technology", pct: 12.4 },
  { name: "Microsoft Corp", title: "Microsoft Corp Common Stock", stem: "59491810", ticker: "MSFT", sector: "Information Technology", pct: 11.8 },
  { name: "NVIDIA Corp", title: "NVIDIA Corp Common Stock", stem: "67066G10", ticker: "NVDA", sector: "Information Technology", pct: 10.2 },
  { name: "Amazon.com Inc", title: "Amazon.com Inc Common Stock", stem: "02313510", ticker: "AMZN", sector: "Consumer Discretionary", pct: 7.9 },
  { name: "Alphabet Inc Class A", title: "Alphabet Inc Cl A Common Stock", stem: "02079K10", ticker: "GOOGL", sector: "Communication Services", pct: 6.1 },
  { name: "Meta Platforms Inc", title: "Meta Platforms Inc Cl A", stem: "30303M10", ticker: "META", sector: "Communication Services", pct: 5.4 },
  { name: "Tesla Inc", title: "Tesla Inc Common Stock", stem: "88160R10", ticker: "TSLA", sector: "Consumer Discretionary", pct: 4.2 },
  { name: "Berkshire Hathaway Inc Cl B", title: "Berkshire Hathaway Cl B", stem: "08467070", ticker: "BRK.B", sector: "Financials", pct: 3.6, ic: "FIN" },
  { name: "JPMorgan Chase & Co", title: "JPMorgan Chase & Co Common", stem: "46625H10", ticker: "JPM", sector: "Financials", pct: 3.1, ic: "FIN" },
  { name: "Visa Inc Class A", title: "Visa Inc Cl A Common Stock", stem: "92826C83", ticker: "V", sector: "Financials", pct: 2.8, ic: "FIN" },
  { name: "UnitedHealth Group Inc", title: "UnitedHealth Group Common", stem: "91324P10", ticker: "UNH", sector: "Health Care", pct: 2.5 },
  { name: "Exxon Mobil Corp", title: "Exxon Mobil Corp Common", stem: "30231G10", ticker: "XOM", sector: "Energy", pct: 2.2 },
  { name: "Johnson & Johnson", title: "Johnson & Johnson Common", stem: "47816010", ticker: "JNJ", sector: "Health Care", pct: 2.1 },
  { name: "Broadcom Inc", title: "Broadcom Inc Common Stock", stem: "11135F10", ticker: "AVGO", sector: "Information Technology", pct: 1.9 },
  { name: "Procter & Gamble Co", title: "Procter & Gamble Common", stem: "74271810", ticker: "PG", sector: "Consumer Staples", pct: 1.8 },
  // Cash sweep to reach ~100%.
  { name: "State Street Instl US Govt Money Market", title: "SSgA Govt MMF", stem: "85749P10", ticker: "GVMXX", sector: "Cash & Equivalents", pct: 22.0, ac: "STIV", ic: "RF" },
];

function buildHoldings(seeds: Seed[], navUsd: number): Holding[] {
  return seeds.map((s, i) => ({
    name: s.name,
    lei: null,
    title: s.title,
    cusip: withCheck(s.stem),
    isin: null,
    ticker: s.ticker,
    balance: Math.round((navUsd * (s.pct / 100)) / (50 + (i % 40))),
    units: "NS",
    valueUsd: Math.round(navUsd * (s.pct / 100)),
    pctOfNetAssets: s.pct,
    assetCategory: s.ac ?? ("EC" as AssetCategory),
    issuerCategory: s.ic ?? ("CORP" as IssuerCategory),
    payoffProfile: "Long" as const,
    country: "US",
    sector: s.sector,
    sourceRow: i + 2,
  }));
}

const NAV = 250_000_000;

/**
 * Reset the database to the canonical demo state: the CORG fund with an approved May
 * filing and a June draft carrying three fixable defects. Used by the local seed script
 * and the hosted demo's nightly reseed endpoint.
 */
export async function seedDemoData(): Promise<string> {
  await db.execute(
    sql`TRUNCATE ${auditEvents}, ${exceptions}, ${holdings}, ${filings}, ${funds} RESTART IDENTITY CASCADE`,
  );

  const [fund] = await db
    .insert(funds)
    .values({
      name: "Corgi US Innovation ETF",
      ticker: "CORG",
      seriesId: "S000099999",
      lei: "549300CORGIINNOV001", // illustrative
      cik: "0002000001",
    })
    .returning();

  // --- Prior filing: June 2026, approved & clean. ---
  const priorHoldings = buildHoldings(PRIOR, NAV);
  const [priorFiling] = await db
    .insert(filings)
    .values({
      fundId: fund.id,
      period: "2026-05",
      repPdDate: "2026-05-31",
      status: "approved",
      sourceFilename: "CORG_holdings_2026-05-31.csv",
      errorCount: 0,
      warningCount: 0,
      approvedBy: "j.rivera@corgi.example (Compliance)",
      approvedAt: new Date("2026-06-05T15:04:00Z"),
    })
    .returning();
  await db.insert(holdings).values(priorHoldings.map((h) => ({ ...h, filingId: priorFiling.id })));
  await db.insert(auditEvents).values([
    { filingId: priorFiling.id, actor: "a.chen@corgi.example (Ops)", action: "filing.created", detail: "Ingested CORG_holdings_2026-05-31.csv (16 rows)" },
    { filingId: priorFiling.id, actor: "system", action: "filing.validated", detail: "0 errors, 0 warnings" },
    { filingId: priorFiling.id, actor: "j.rivera@corgi.example (Compliance)", action: "filing.approved", detail: "Approved for EDGAR submission" },
  ]);

  // --- Current filing: July 2026, draft, WITH deliberate defects. ---
  let current = buildHoldings(PRIOR, NAV).map((h) => ({ ...h }));
  const byTicker = (t: string) => current.find((h) => h.ticker === t) as Holding;
  // Drift: NVDA up, TSLA trimmed, AAPL down (feeds the diff view).
  byTicker("NVDA").pctOfNetAssets = 11.6; // +1.4
  byTicker("TSLA").pctOfNetAssets = 2.9; // -1.3
  byTicker("AAPL").pctOfNetAssets = 11.2; // -1.2
  // Position change: drop Procter & Gamble, add Eli Lilly.
  current = current.filter((h) => h.ticker !== "PG");
  current.push({
    name: "Eli Lilly & Co",
    lei: null,
    title: "Eli Lilly & Co Common Stock",
    cusip: withCheck("53245710"),
    isin: null,
    ticker: "LLY",
    balance: 42000,
    units: "NS",
    valueUsd: Math.round(NAV * 0.018),
    pctOfNetAssets: 1.8,
    assetCategory: "EC",
    issuerCategory: "CORP",
    payoffProfile: "Long",
    country: "US",
    sector: "Health Care",
    sourceRow: 0,
  });
  // Re-number source rows and re-derive value from weight so the book is internally
  // consistent (implied NAV stable) before we plant the deliberate defects.
  current = current.map((h, i) => ({
    ...h,
    sourceRow: i + 2,
    valueUsd: Math.round(NAV * (h.pctOfNetAssets / 100)),
  }));

  // DEFECT 1 (error): corrupt a CUSIP check digit (transposition typo from the fund admin).
  byTicker("MSFT").cusip = "59491801"; // valid was 594918104
  // DEFECT 2 (warning): value/weight mismatch on Amazon — value doesn't match its %.
  byTicker("AMZN").valueUsd = Math.round(byTicker("AMZN").valueUsd * 1.4);
  // DEFECT 3 (error): unknown asset category code.
  byTicker("XOM").assetCategory = "XYZ" as AssetCategory;

  const [curFiling] = await db
    .insert(filings)
    .values({
      fundId: fund.id,
      period: "2026-06",
      repPdDate: "2026-06-30",
      status: "draft",
      sourceFilename: "CORG_holdings_2026-06-30.csv",
      errorCount: 0,
      warningCount: 0,
    })
    .returning();
  await db.insert(holdings).values(current.map((h) => ({ ...h, filingId: curFiling.id })));
  await db.insert(auditEvents).values({
    filingId: curFiling.id,
    actor: "a.chen@corgi.example (Ops)",
    action: "filing.created",
    detail: `Ingested CORG_holdings_2026-06-30.csv (${current.length} rows)`,
  });

  // Validate both filings and persist exceptions + counts (mirrors the app's ingest path).
  await persistValidation(priorFiling.id, priorHoldings);
  await persistValidation(curFiling.id, current);

  return `Seeded fund #${fund.id} (CORG) with filings ${priorFiling.id} (approved) and ${curFiling.id} (draft w/ defects).`;
}
