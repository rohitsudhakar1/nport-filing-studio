import type { DiffSummary, Holding, HoldingsDiffRow } from "@/lib/types";

const WEIGHT_DELTA_THRESHOLD = 0.1; // percentage points

function keyOf(h: Holding): string {
  // Match on the most position-stable identifier available. Ticker first (an equity's
  // ticker survives a CUSIP typo), then CUSIP/ISIN, then name — so a mistyped identifier
  // shows up as a validation error, not a phantom add + remove in the change review.
  return (h.ticker || h.cusip || h.isin || h.name).toUpperCase().trim();
}

/**
 * Compare current holdings against the prior period. Powers the "explainable &
 * reviewable" story: a reviewer sees exactly what changed since last month's filing.
 */
export function diffHoldings(current: Holding[], prior: Holding[]): DiffSummary {
  const priorMap = new Map(prior.map((h) => [keyOf(h), h]));
  const currMap = new Map(current.map((h) => [keyOf(h), h]));
  const rows: HoldingsDiffRow[] = [];

  for (const h of current) {
    const k = keyOf(h);
    const p = priorMap.get(k);
    if (!p) {
      rows.push({
        key: k,
        name: h.name,
        kind: "added",
        priorPct: null,
        currentPct: h.pctOfNetAssets,
        deltaPct: h.pctOfNetAssets,
      });
    } else {
      const delta = h.pctOfNetAssets - p.pctOfNetAssets;
      rows.push({
        key: k,
        name: h.name,
        kind: Math.abs(delta) >= WEIGHT_DELTA_THRESHOLD ? "weight_change" : "unchanged",
        priorPct: p.pctOfNetAssets,
        currentPct: h.pctOfNetAssets,
        deltaPct: delta,
      });
    }
  }

  for (const p of prior) {
    const k = keyOf(p);
    if (!currMap.has(k)) {
      rows.push({
        key: k,
        name: p.name,
        kind: "removed",
        priorPct: p.pctOfNetAssets,
        currentPct: null,
        deltaPct: -p.pctOfNetAssets,
      });
    }
  }

  // Sort: added/removed first, then largest absolute weight moves.
  const order = { added: 0, removed: 1, weight_change: 2, unchanged: 3 } as const;
  rows.sort((a, b) => {
    if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
    return Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0);
  });

  return {
    added: rows.filter((r) => r.kind === "added").length,
    removed: rows.filter((r) => r.kind === "removed").length,
    weightChanged: rows.filter((r) => r.kind === "weight_change").length,
    unchanged: rows.filter((r) => r.kind === "unchanged").length,
    rows,
  };
}
