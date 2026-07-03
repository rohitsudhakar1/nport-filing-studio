import "server-only";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  exceptions,
  type FilingRow,
  filings,
  type FundRow,
  holdings,
} from "@/db/schema";
import { diffHoldings } from "@/lib/diff";
import { type FixSuggestion, suggestFix } from "@/lib/fixes";
import type { DiffSummary, Holding } from "@/lib/types";

function rowToHolding(r: typeof holdings.$inferSelect): Holding {
  return {
    name: r.name,
    lei: r.lei,
    title: r.title,
    cusip: r.cusip,
    isin: r.isin,
    ticker: r.ticker,
    balance: r.balance,
    units: r.units,
    valueUsd: r.valueUsd,
    pctOfNetAssets: r.pctOfNetAssets,
    assetCategory: r.assetCategory as Holding["assetCategory"],
    issuerCategory: r.issuerCategory as Holding["issuerCategory"],
    payoffProfile: r.payoffProfile as Holding["payoffProfile"],
    country: r.country,
    sector: r.sector,
    sourceRow: r.sourceRow,
  };
}

export async function getDashboard(): Promise<{ fund: FundRow; filings: FilingRow[] }[]> {
  const rows = await db.query.funds.findMany({
    with: { filings: { orderBy: (f, { desc: d }) => d(f.period) } },
  });
  return rows.map((r) => ({ fund: r as unknown as FundRow, filings: r.filings }));
}

export async function getFundByTicker(ticker: string) {
  return db.query.funds.findFirst({ where: (f, { eq: e }) => e(f.ticker, ticker.toUpperCase()) });
}

export type ExceptionWithFix = typeof exceptions.$inferSelect & {
  suggestion: FixSuggestion | null;
};

export interface FilingDetail {
  filing: FilingRow;
  fund: FundRow;
  holdings: Holding[];
  exceptions: ExceptionWithFix[];
  audit: (typeof auditEvents.$inferSelect)[];
  diff: DiffSummary | null;
  priorPeriod: string | null;
}

export async function getFilingDetail(filingId: number): Promise<FilingDetail | null> {
  const filing = await db.query.filings.findFirst({ where: eq(filings.id, filingId) });
  if (!filing) return null;

  const fund = (await db.query.funds.findFirst({
    where: (f, { eq: e }) => e(f.id, filing.fundId),
  })) as FundRow;

  const hRows = await db
    .select()
    .from(holdings)
    .where(eq(holdings.filingId, filingId))
    .orderBy(desc(holdings.pctOfNetAssets));
  const current = hRows.map(rowToHolding);

  const excRows = await db
    .select()
    .from(exceptions)
    .where(eq(exceptions.filingId, filingId));
  // severity then row order
  const sevOrder = { error: 0, warning: 1, info: 2 } as const;
  excRows.sort(
    (a, b) =>
      (sevOrder[a.severity as keyof typeof sevOrder] ?? 9) -
        (sevOrder[b.severity as keyof typeof sevOrder] ?? 9) ||
      (a.holdingRow ?? 0) - (b.holdingRow ?? 0),
  );

  const audit = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.filingId, filingId))
    .orderBy(desc(auditEvents.createdAt));

  // Prior filing (previous period, same fund) for the diff + fix reconciliation.
  const priorFiling = await db.query.filings.findFirst({
    where: and(eq(filings.fundId, filing.fundId), lt(filings.period, filing.period)),
    orderBy: (f, { desc: d }) => d(f.period),
  });
  let diff: DiffSummary | null = null;
  let priorPeriod: string | null = null;
  let priorHoldings: Holding[] = [];
  if (priorFiling) {
    const priorRows = await db.select().from(holdings).where(eq(holdings.filingId, priorFiling.id));
    priorHoldings = priorRows.map(rowToHolding);
    diff = diffHoldings(current, priorHoldings);
    priorPeriod = priorFiling.period;
  }

  // Attach a suggested fix (if one can be computed safely) to each open exception.
  const excWithFixes: ExceptionWithFix[] = excRows.map((e) => ({
    ...e,
    suggestion:
      e.status === "resolved"
        ? null
        : suggestFix(e.code, e.holdingRow, current, priorHoldings, priorPeriod),
  }));

  return { filing, fund, holdings: current, exceptions: excWithFixes, audit, diff, priorPeriod };
}

export async function getApprovedFilingForFund(fundId: number) {
  const filing = await db.query.filings.findFirst({
    where: and(eq(filings.fundId, fundId), eq(filings.status, "approved")),
    orderBy: (f, { desc: d }) => d(f.period),
  });
  if (!filing) return null;
  const hRows = await db
    .select()
    .from(holdings)
    .where(eq(holdings.filingId, filing.id))
    .orderBy(desc(holdings.pctOfNetAssets));
  return { filing, holdings: hRows.map(rowToHolding) };
}

export { rowToHolding };
