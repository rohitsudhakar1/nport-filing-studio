import type { AssetCategory, Holding } from "@/lib/types";
import { ASSET_CATEGORIES } from "@/lib/types";
import { isValidCusip } from "@/lib/validators/identifiers";

// Suggested-fix engine. Mirrors what a fund-ops analyst does by hand: reconcile the
// suspect row against the last approved filing, or repair the identifier arithmetic.
// Suggestions are computed server-side and re-verified before being applied.

export interface FixSuggestion {
  /** Which holding row the fix applies to (sourceRow). */
  targetRow: number;
  field: "cusip" | "valueUsd" | "assetCategory";
  currentValue: string;
  suggestedValue: string | number;
  /** Rendered next to the before → after so the reviewer knows WHY this is the fix. */
  rationale: string;
}

function cusipCheckDigit(stem8: string): string {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const c = stem8[i];
    let v: number;
    if (c >= "0" && c <= "9") v = c.charCodeAt(0) - 48;
    else if (c >= "A" && c <= "Z") v = c.charCodeAt(0) - 55;
    else if (c === "*") v = 36;
    else if (c === "@") v = 37;
    else v = 38;
    if (i % 2 === 1) v *= 2;
    sum += Math.floor(v / 10) + (v % 10);
  }
  return String((10 - (sum % 10)) % 10);
}

function matchPrior(h: Holding, prior: Holding[]): Holding | undefined {
  return prior.find(
    (p) =>
      (h.ticker && p.ticker && p.ticker.toUpperCase() === h.ticker.toUpperCase()) ||
      p.name.toUpperCase().trim() === h.name.toUpperCase().trim(),
  );
}

function suggestCusipFix(h: Holding, prior: Holding[], priorPeriod: string | null): FixSuggestion | null {
  if (!h.cusip) return null;
  const current = h.cusip.trim().toUpperCase();

  // 1) Best evidence: the same security in the last approved filing.
  const p = matchPrior(h, prior);
  if (p?.cusip && isValidCusip(p.cusip) && p.cusip !== current) {
    return {
      targetRow: h.sourceRow,
      field: "cusip",
      currentValue: current,
      suggestedValue: p.cusip,
      rationale: `${h.ticker ?? h.name} is listed with CUSIP ${p.cusip} in the prior approved filing${priorPeriod ? ` (${priorPeriod})` : ""}.`,
    };
  }

  // 2) Arithmetic repair: recompute the check digit from the 8-character stem.
  if (/^[0-9A-Z*@#]{8}$/.test(current)) {
    const repaired = current + cusipCheckDigit(current);
    return {
      targetRow: h.sourceRow,
      field: "cusip",
      currentValue: current,
      suggestedValue: repaired,
      rationale: "CUSIP is 8 characters — check digit recomputed from the issuer/issue stem.",
    };
  }
  if (/^[0-9A-Z*@#]{9}$/.test(current)) {
    const repaired = current.slice(0, 8) + cusipCheckDigit(current.slice(0, 8));
    if (repaired !== current) {
      return {
        targetRow: h.sourceRow,
        field: "cusip",
        currentValue: current,
        suggestedValue: repaired,
        rationale: "Check digit corrected for the given 8-character stem.",
      };
    }
  }
  return null;
}

function suggestCategoryFix(h: Holding, prior: Holding[], priorPeriod: string | null): FixSuggestion | null {
  const p = matchPrior(h, prior);
  if (p && p.assetCategory in ASSET_CATEGORIES && p.assetCategory !== h.assetCategory) {
    return {
      targetRow: h.sourceRow,
      field: "assetCategory",
      currentValue: h.assetCategory,
      suggestedValue: p.assetCategory,
      rationale: `${h.ticker ?? h.name} was categorized ${p.assetCategory} (${ASSET_CATEGORIES[p.assetCategory as AssetCategory]}) in the prior approved filing${priorPeriod ? ` (${priorPeriod})` : ""}.`,
    };
  }
  return null;
}

/** Find the row whose value disagrees with its weight, and recompute the value from the
 * fund's median implied NAV. */
function suggestValueFix(holdings: Holding[]): FixSuggestion | null {
  const usable = holdings.filter((h) => h.pctOfNetAssets > 0.05 && h.valueUsd > 0);
  if (usable.length < 3) return null;
  const implied = usable
    .map((h) => ({ h, nav: h.valueUsd / (h.pctOfNetAssets / 100) }))
    .sort((a, b) => a.nav - b.nav);
  const median = implied[Math.floor(implied.length / 2)].nav;
  let worst: { h: Holding; dev: number } | null = null;
  for (const { h, nav } of implied) {
    const dev = Math.abs(nav - median) / median;
    if (!worst || dev > worst.dev) worst = { h, dev };
  }
  if (!worst || worst.dev < 0.02) return null;
  const suggested = Math.round(median * (worst.h.pctOfNetAssets / 100));
  return {
    targetRow: worst.h.sourceRow,
    field: "valueUsd",
    currentValue: String(worst.h.valueUsd),
    suggestedValue: suggested,
    rationale: `${worst.h.ticker ?? worst.h.name}'s value implies a NAV ${(worst.dev * 100).toFixed(1)}% away from the fund's median. Recomputed as ${worst.h.pctOfNetAssets.toFixed(2)}% of the median implied NAV.`,
  };
}

/** Compute a suggested fix for an exception, or null if no safe suggestion exists. */
export function suggestFix(
  code: string,
  holdingRow: number | null,
  holdings: Holding[],
  priorHoldings: Holding[],
  priorPeriod: string | null,
): FixSuggestion | null {
  const holding = holdingRow !== null ? holdings.find((h) => h.sourceRow === holdingRow) : undefined;
  switch (code) {
    case "BAD_CUSIP":
      return holding ? suggestCusipFix(holding, priorHoldings, priorPeriod) : null;
    case "BAD_ASSET_CATEGORY":
      return holding ? suggestCategoryFix(holding, priorHoldings, priorPeriod) : null;
    case "VALUE_WEIGHT_MISMATCH":
      return suggestValueFix(holdings);
    default:
      return null;
  }
}
