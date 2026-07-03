import {
  ASSET_CATEGORIES,
  type Holding,
  ISSUER_CATEGORIES,
  PAYOFF_PROFILES,
  type ValidationFinding,
} from "@/lib/types";
import { isValidCusip, isValidIsin, isValidLei } from "./identifiers";

// Rule engine for a set of holdings destined for a Form N-PORT filing.
// Each rule maps to a real filing constraint; the `code` is a stable id so the same
// exception can be tracked across re-uploads.

const NET_ASSETS_TOLERANCE = 0.5; // ± percentage points around 100%
const CONCENTRATION_WARN_PCT = 25; // single-issuer concentration heads-up

export function validateHoldings(holdings: Holding[]): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const add = (
    code: string,
    severity: ValidationFinding["severity"],
    message: string,
    holdingRow: number | null = null,
    field: string | null = null,
  ) => findings.push({ code, severity, message, holdingRow, field });

  if (holdings.length === 0) {
    add("EMPTY_PORTFOLIO", "error", "Filing contains no holdings.", null, null);
    return findings;
  }

  // --- Per-holding rules ---
  const seenIds = new Map<string, number>();
  for (const h of holdings) {
    const row = h.sourceRow;

    if (!h.name?.trim()) add("MISSING_NAME", "error", "Missing issuer name (C.1.a).", row, "name");
    if (!h.title?.trim())
      add("MISSING_TITLE", "error", "Missing title of issue (C.1.c).", row, "title");

    // Identifiers: N-PORT requires at least one of CUSIP/ISIN/LEI/ticker.
    const hasAnyId = h.cusip || h.isin || h.lei || h.ticker;
    if (!hasAnyId)
      add("NO_IDENTIFIER", "error", "No CUSIP, ISIN, LEI, or ticker provided.", row, "cusip");

    if (h.cusip && !isValidCusip(h.cusip))
      add("BAD_CUSIP", "error", `CUSIP "${h.cusip}" fails check-digit validation.`, row, "cusip");
    if (h.isin && !isValidIsin(h.isin))
      add("BAD_ISIN", "error", `ISIN "${h.isin}" fails check-digit validation.`, row, "isin");
    if (h.lei && !isValidLei(h.lei))
      add("BAD_LEI", "warning", `LEI "${h.lei}" fails ISO 17442 check digits.`, row, "lei");

    // Duplicate identifier across rows.
    const idKey = (h.cusip || h.isin || h.ticker || h.name).toUpperCase();
    if (seenIds.has(idKey)) {
      add(
        "DUPLICATE_HOLDING",
        "warning",
        `Duplicate position — same identifier as row ${seenIds.get(idKey)}.`,
        row,
        "cusip",
      );
    } else {
      seenIds.set(idKey, row);
    }

    // Enums.
    if (!(h.assetCategory in ASSET_CATEGORIES))
      add(
        "BAD_ASSET_CATEGORY",
        "error",
        `Unknown asset category "${h.assetCategory}" (C.4.a).`,
        row,
        "assetCategory",
      );
    if (!(h.issuerCategory in ISSUER_CATEGORIES))
      add(
        "BAD_ISSUER_CATEGORY",
        "error",
        `Unknown issuer category "${h.issuerCategory}" (C.4.b).`,
        row,
        "issuerCategory",
      );
    if (!PAYOFF_PROFILES.includes(h.payoffProfile))
      add(
        "BAD_PAYOFF",
        "error",
        `Payoff profile must be Long/Short/N/A (C.5.a).`,
        row,
        "payoffProfile",
      );

    // Numeric sanity.
    if (!Number.isFinite(h.valueUsd))
      add("BAD_VALUE", "error", "Value (C.3) is not a number.", row, "valueUsd");
    if (h.valueUsd < 0 && h.payoffProfile !== "Short")
      add(
        "NEGATIVE_VALUE",
        "warning",
        "Negative value on a non-Short position — confirm payoff profile.",
        row,
        "valueUsd",
      );
    if (!Number.isFinite(h.pctOfNetAssets))
      add("BAD_PCT", "error", "Percentage of net assets (C.3) is not a number.", row, "pctOfNetAssets");
    if (h.pctOfNetAssets > CONCENTRATION_WARN_PCT)
      add(
        "CONCENTRATION",
        "info",
        `Single position is ${h.pctOfNetAssets.toFixed(2)}% of net assets.`,
        row,
        "pctOfNetAssets",
      );

    // Country: ISO 3166-1 alpha-2 shape.
    if (!/^[A-Z]{2}$/.test(h.country || ""))
      add(
        "BAD_COUNTRY",
        "warning",
        `Country "${h.country}" is not an ISO alpha-2 code (C.4.c).`,
        row,
        "country",
      );
  }

  // --- Filing-level rules ---
  const totalPct = holdings.reduce((s, h) => s + (Number.isFinite(h.pctOfNetAssets) ? h.pctOfNetAssets : 0), 0);
  if (Math.abs(totalPct - 100) > NET_ASSETS_TOLERANCE) {
    add(
      "WEIGHTS_DONT_SUM",
      totalPct > 105 || totalPct < 95 ? "error" : "warning",
      `Holdings sum to ${totalPct.toFixed(2)}% of net assets (expected ~100%). ` +
        `Off by ${(totalPct - 100).toFixed(2)} pts.`,
      null,
      "pctOfNetAssets",
    );
  }

  // Value vs. weight internal consistency: implied NAV should be stable across holdings.
  const navImplied = holdings
    .filter((h) => h.pctOfNetAssets > 0.05 && h.valueUsd > 0)
    .map((h) => h.valueUsd / (h.pctOfNetAssets / 100));
  if (navImplied.length > 2) {
    const mean = navImplied.reduce((a, b) => a + b, 0) / navImplied.length;
    const maxDev = Math.max(...navImplied.map((n) => Math.abs(n - mean) / mean));
    if (maxDev > 0.02) {
      add(
        "VALUE_WEIGHT_MISMATCH",
        "warning",
        `Value vs. %-of-net-assets is internally inconsistent (implied NAV varies by ` +
          `${(maxDev * 100).toFixed(1)}%). A row's value and weight likely disagree.`,
        null,
        "valueUsd",
      );
    }
  }

  return findings;
}

export function summarizeFindings(findings: ValidationFinding[]) {
  return {
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
}
