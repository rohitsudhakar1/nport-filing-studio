"use server";

import { and, eq, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { exceptions, filings, funds, holdings } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { csvToHoldings } from "@/lib/csv";
import { fetchNport, listNportFilings, resolveFund } from "@/lib/edgar";
import { sendApprovalEmail } from "@/lib/email";
import { rowToHolding } from "@/lib/filing-service";
import { suggestFix } from "@/lib/fixes";
import { summarizeFindings, validateHoldings } from "@/lib/validators/nport-rules";

// A single hard-coded actor for the demo. In production this comes from the session.
const ACTOR = "you@corgi.example (Reviewer)";

/** Re-run validation for a filing, replacing its stored exceptions. Preserves triage
 * status/notes for exceptions that still exist (matched by code + row). */
export async function revalidateFiling(filingId: number) {
  const hRows = await db.select().from(holdings).where(eq(holdings.filingId, filingId));
  const findings = validateHoldings(
    hRows.map((r) => ({
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
      assetCategory: r.assetCategory as never,
      issuerCategory: r.issuerCategory as never,
      payoffProfile: r.payoffProfile as never,
      country: r.country,
      sector: r.sector,
      sourceRow: r.sourceRow,
    })),
  );

  const prior = await db.select().from(exceptions).where(eq(exceptions.filingId, filingId));
  const priorByKey = new Map(prior.map((e) => [`${e.code}:${e.holdingRow ?? "f"}`, e]));

  await db.delete(exceptions).where(eq(exceptions.filingId, filingId));
  if (findings.length > 0) {
    await db.insert(exceptions).values(
      findings.map((f) => {
        const carried = priorByKey.get(`${f.code}:${f.holdingRow ?? "f"}`);
        return {
          filingId,
          code: f.code,
          severity: f.severity,
          message: f.message,
          holdingRow: f.holdingRow,
          field: f.field,
          status: carried?.status ?? "open",
          note: carried?.note ?? null,
          resolvedBy: carried?.resolvedBy ?? null,
          resolvedAt: carried?.resolvedAt ?? null,
        };
      }),
    );
  }

  const s = summarizeFindings(findings);
  await db
    .update(filings)
    .set({ errorCount: s.errors, warningCount: s.warnings })
    .where(eq(filings.id, filingId));
  await logAudit(
    filingId,
    "system (validator)",
    "filing.validated",
    `${s.errors} errors, ${s.warnings} warnings, ${s.info} info`,
  );
  revalidatePath(`/filings/${filingId}`);
}

/** Ingest a holdings CSV into a NEW draft filing for an existing fund, then validate. */
export async function ingestCsv(input: {
  fundId: number;
  period: string;
  repPdDate: string;
  filename: string;
  csv: string;
}) {
  const { holdings: parsed, errors } = csvToHoldings(input.csv);
  if (parsed.length === 0) {
    return { ok: false as const, error: errors.join("; ") || "No holdings found in file." };
  }

  const [filing] = await db
    .insert(filings)
    .values({
      fundId: input.fundId,
      period: input.period,
      repPdDate: input.repPdDate,
      status: "draft",
      sourceFilename: input.filename,
    })
    .returning();

  await db.insert(holdings).values(parsed.map((h) => ({ ...h, filingId: filing.id })));
  await logAudit(
    filing.id,
    ACTOR,
    "filing.created",
    `Ingested ${input.filename} (${parsed.length} rows)`,
  );
  await revalidateFiling(filing.id);
  revalidatePath("/");
  return { ok: true as const, filingId: filing.id };
}

export async function setExceptionStatus(
  exceptionId: number,
  filingId: number,
  status: "open" | "acknowledged" | "resolved",
  note: string,
) {
  await db
    .update(exceptions)
    .set({
      status,
      note: note || null,
      resolvedBy: status === "resolved" ? ACTOR : null,
      resolvedAt: status === "resolved" ? new Date() : null,
    })
    .where(eq(exceptions.id, exceptionId));
  await logAudit(
    filingId,
    ACTOR,
    `exception.${status}`,
    note ? `Exception #${exceptionId}: ${note}` : `Exception #${exceptionId}`,
  );
  revalidatePath(`/filings/${filingId}`);
}

/**
 * Apply a suggested fix to the underlying holding data. The suggestion is recomputed
 * server-side from current data (never trusted from the client), applied, audit-logged
 * with before -> after, and the filing is re-validated.
 */
export async function applyFix(exceptionId: number, filingId: number) {
  const exc = await db.query.exceptions.findFirst({
    where: eq(exceptions.id, exceptionId),
  });
  if (!exc || exc.filingId !== filingId) return { ok: false as const, error: "Exception not found." };

  const filing = await db.query.filings.findFirst({ where: eq(filings.id, filingId) });
  if (!filing) return { ok: false as const, error: "Filing not found." };

  const hRows = await db.select().from(holdings).where(eq(holdings.filingId, filingId));
  const current = hRows.map(rowToHolding);

  const priorFiling = await db.query.filings.findFirst({
    where: and(eq(filings.fundId, filing.fundId), lt(filings.period, filing.period)),
    orderBy: (f, { desc: d }) => d(f.period),
  });
  let prior: ReturnType<typeof rowToHolding>[] = [];
  if (priorFiling) {
    const priorRows = await db.select().from(holdings).where(eq(holdings.filingId, priorFiling.id));
    prior = priorRows.map(rowToHolding);
  }

  const fix = suggestFix(exc.code, exc.holdingRow, current, prior, priorFiling?.period ?? null);
  if (!fix) return { ok: false as const, error: "No safe automatic fix is available for this exception." };

  const target = hRows.find((r) => r.sourceRow === fix.targetRow);
  if (!target) return { ok: false as const, error: "Target holding not found." };

  await db
    .update(holdings)
    .set({ [fix.field]: fix.suggestedValue })
    .where(eq(holdings.id, target.id));

  await logAudit(
    filingId,
    ACTOR,
    "exception.fix_applied",
    `${target.name} ${fix.field}: ${fix.currentValue} → ${fix.suggestedValue}. ${fix.rationale}`,
  );

  await revalidateFiling(filingId);
  return { ok: true as const };
}

/**
 * Approve a filing for EDGAR submission with a written attestation (evidence capture).
 * Blocks if any open ERROR-level exception remains.
 */
export async function approveFiling(filingId: number, attestation: string) {
  const filing = await db.query.filings.findFirst({ where: eq(filings.id, filingId) });
  if (!filing) return { ok: false as const, error: "Filing not found." };
  if (!attestation.trim()) {
    return { ok: false as const, error: "An attestation note is required to approve." };
  }

  const open = await db.select().from(exceptions).where(eq(exceptions.filingId, filingId));
  const blockingErrors = open.filter((e) => e.severity === "error" && e.status !== "resolved");
  if (blockingErrors.length > 0) {
    return {
      ok: false as const,
      error: `${blockingErrors.length} unresolved error(s) must be resolved before approval.`,
    };
  }

  await db
    .update(filings)
    .set({ status: "approved", approvedBy: ACTOR, approvedAt: new Date() })
    .where(eq(filings.id, filingId));
  await logAudit(filingId, ACTOR, "filing.approved", `Attestation: ${attestation.trim()}`);

  const fund = await db.query.funds.findFirst({ where: (f, { eq: e }) => e(f.id, filing.fundId) });
  await sendApprovalEmail({
    fundName: fund?.name ?? "Fund",
    ticker: fund?.ticker ?? "",
    period: filing.period,
    approver: ACTOR,
  });

  revalidatePath(`/filings/${filingId}`);
  revalidatePath("/");
  return { ok: true as const };
}

/**
 * Import a real fund's N-PORT filings from SEC EDGAR by ticker.
 * The two most recent filings are ingested: the earlier lands as approved reference data
 * (it is a filed SEC document), the latest lands in the review queue so the full
 * validate -> diff -> approve workflow can be exercised on real regulatory data.
 */
export async function importFromEdgar(ticker: string) {
  try {
    const ref = await resolveFund(ticker);
    if (!ref) {
      return {
        ok: false as const,
        error: `"${ticker.toUpperCase()}" isn't in EDGAR's fund registry. N-PORT is filed by funds, not companies — a stock like AAPL has no N-PORT. Try an ETF ticker such as IVV, VTI, or VOO.`,
      };
    }

    const filingRefs = await listNportFilings(ref.seriesId, 2);
    if (filingRefs.length === 0) {
      return { ok: false as const, error: `${ticker.toUpperCase()} has no N-PORT filings on EDGAR.` };
    }

    // Oldest first so the diff has a prior period.
    const ordered = [...filingRefs].reverse();
    const parsed = [];
    for (const fr of ordered) {
      parsed.push({ ref: fr, doc: await fetchNport(ref.cik, fr.accession) });
    }

    const first = parsed[0].doc;
    // Upsert the fund by ticker.
    let fund = await db.query.funds.findFirst({
      where: (f, { eq: e }) => e(f.ticker, ref.symbol),
    });
    if (!fund) {
      const [created] = await db
        .insert(funds)
        .values({
          name: first.seriesName,
          ticker: ref.symbol,
          seriesId: ref.seriesId,
          lei: first.seriesLei || "UNKNOWN",
          cik: String(ref.cik),
        })
        .returning();
      fund = created;
    }

    let lastFilingId = 0;
    for (let i = 0; i < parsed.length; i++) {
      const { ref: fr, doc } = parsed[i];
      const period = doc.repPdEnd.slice(0, 7);
      const isLatest = i === parsed.length - 1;

      // Skip periods already imported.
      const existing = await db.query.filings.findFirst({
        where: (f, { and: a, eq: e }) => a(e(f.fundId, fund.id), e(f.period, period)),
      });
      if (existing) {
        lastFilingId = existing.id;
        continue;
      }

      const [filing] = await db
        .insert(filings)
        .values({
          fundId: fund.id,
          period,
          repPdDate: doc.repPdEnd,
          status: isLatest ? "draft" : "approved",
          sourceFilename: `EDGAR ${fr.accession}`,
          approvedBy: isLatest ? null : "SEC EDGAR (as filed)",
          approvedAt: isLatest ? null : new Date(`${fr.filingDate}T00:00:00`),
        })
        .returning();
      await db.insert(holdings).values(doc.holdings.map((h) => ({ ...h, filingId: filing.id })));
      await logAudit(
        filing.id,
        "system (EDGAR import)",
        "filing.imported",
        `Accession ${fr.accession}, filed ${fr.filingDate}: ${doc.holdings.length} holdings, period ${doc.repPdEnd}.`,
      );
      await revalidateFiling(filing.id);
      lastFilingId = filing.id;
    }

    revalidatePath("/");
    return { ok: true as const, filingId: lastFilingId, fundName: first.seriesName };
  } catch (e) {
    console.error("[edgar import]", e);
    return { ok: false as const, error: "EDGAR request failed — the SEC rate-limits aggressive clients; try again in a moment." };
  }
}

/** Send an approved/in-review filing back to draft (e.g. new data arrived). */
export async function reopenFiling(filingId: number, reason: string) {
  await db
    .update(filings)
    .set({ status: "draft", approvedBy: null, approvedAt: null })
    .where(eq(filings.id, filingId));
  await logAudit(filingId, ACTOR, "filing.reopened", reason || "Reopened to draft");
  revalidatePath(`/filings/${filingId}`);
  revalidatePath("/");
}
