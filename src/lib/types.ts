// Domain types for Form N-PORT holdings.
// Field names/enums mirror the SEC Form N-PORT XML technical spec (Part C — schedule of
// portfolio investments). Kept intentionally close to the filing so mapping is 1:1.

/** N-PORT Item C.4.a — asset category codes. */
export const ASSET_CATEGORIES = {
  STIV: "Short-term investment vehicle",
  RA: "Repurchase agreement",
  EC: "Equity-common",
  EP: "Equity-preferred",
  DBT: "Debt",
  DCO: "Derivative-commodity",
  DE: "Derivative-equity",
  DFE: "Derivative-foreign exchange",
  DIR: "Derivative-interest rate",
  DCR: "Derivative-credit",
  SN: "Structured note",
  LON: "Loan",
  ABS: "Asset-backed security",
  COMM: "Commodity",
  RE: "Real estate",
} as const;
export type AssetCategory = keyof typeof ASSET_CATEGORIES;

/** N-PORT Item C.4.b — issuer category codes. */
export const ISSUER_CATEGORIES = {
  CORP: "Corporate",
  FIN: "Financial company",
  MUN: "Municipal",
  MBS: "Mortgage-backed security",
  ABS: "Asset-backed",
  GDR: "Global depositary receipt",
  PF: "Private fund",
  RF: "Registered fund",
  UST: "U.S. Treasury",
  USGA: "U.S. government agency",
  SOV: "Foreign sovereign",
} as const;
export type IssuerCategory = keyof typeof ISSUER_CATEGORIES;

/** Derivative asset categories: futures/swaps/options have no CUSIP/ISIN and can carry
 * negative unrealized values — validation treats them differently from cash securities. */
export const DERIVATIVE_CATEGORIES = new Set(["DCO", "DE", "DFE", "DIR", "DCR"]);
export function isDerivative(cat: string): boolean {
  return DERIVATIVE_CATEGORIES.has(cat);
}

/** N-PORT Item C.5.a — payoff profile. */
export const PAYOFF_PROFILES = ["Long", "Short", "N/A"] as const;
export type PayoffProfile = (typeof PAYOFF_PROFILES)[number];

/** A single portfolio holding, as ingested from a fund-admin file and mapped to N-PORT fields. */
export interface Holding {
  /** Item C.1.a */
  name: string;
  /** Item C.1.b — LEI (20 chars) */
  lei: string | null;
  /** Item C.1.c — title of the issue */
  title: string;
  /** Item C.1.d.i — CUSIP */
  cusip: string | null;
  /** Item C.1.d.ii — ISIN */
  isin: string | null;
  ticker: string | null;
  /** Item C.2 — number of shares / principal amount */
  balance: number;
  /** Item C.2 — "NS" (shares), "PA" (principal), etc. */
  units: string;
  /** Item C.3 — value in USD */
  valueUsd: number;
  /** Item C.3 — percentage of net assets */
  pctOfNetAssets: number;
  assetCategory: AssetCategory;
  issuerCategory: IssuerCategory;
  payoffProfile: PayoffProfile;
  /** Item C.4.c — country of investment/issuer (ISO 3166-1 alpha-2) */
  country: string;
  /** Optional GICS-style sector, used for the public exposure breakdown. */
  sector: string | null;
  /** Provenance: 1-indexed source row in the uploaded file. */
  sourceRow: number;
}

export type Severity = "error" | "warning" | "info";

export interface ValidationFinding {
  code: string;
  severity: Severity;
  /** Human-readable message. */
  message: string;
  /** Which holding it refers to (null = filing-level). */
  holdingRow: number | null;
  field: string | null;
}

export type ExceptionStatus = "open" | "acknowledged" | "resolved";

export interface HoldingsDiffRow {
  key: string; // cusip|isin|name
  name: string;
  kind: "added" | "removed" | "weight_change" | "unchanged";
  priorPct: number | null;
  currentPct: number | null;
  deltaPct: number | null;
}

export interface DiffSummary {
  added: number;
  removed: number;
  weightChanged: number;
  unchanged: number;
  rows: HoldingsDiffRow[];
}
