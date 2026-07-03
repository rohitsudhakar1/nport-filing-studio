import type { AssetCategory, Holding, IssuerCategory, PayoffProfile } from "@/lib/types";

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

const HEADER_ALIASES: Record<string, keyof Holding> = {
  name: "name",
  issuer: "name",
  issuer_name: "name",
  lei: "lei",
  title: "title",
  title_of_issue: "title",
  security: "title",
  cusip: "cusip",
  isin: "isin",
  ticker: "ticker",
  symbol: "ticker",
  balance: "balance",
  shares: "balance",
  quantity: "balance",
  units: "units",
  unit_type: "units",
  value: "valueUsd",
  value_usd: "valueUsd",
  market_value: "valueUsd",
  pct: "pctOfNetAssets",
  pct_net_assets: "pctOfNetAssets",
  percent_of_net_assets: "pctOfNetAssets",
  weight: "pctOfNetAssets",
  asset_category: "assetCategory",
  asset_cat: "assetCategory",
  issuer_category: "issuerCategory",
  issuer_cat: "issuerCategory",
  payoff: "payoffProfile",
  payoff_profile: "payoffProfile",
  country: "country",
  sector: "sector",
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_").replace(/%/g, "pct").replace(/[^a-z0-9_]/g, "");
}

function num(v: string): number {
  const n = Number((v ?? "").replace(/[$,\s%]/g, ""));
  return Number.isFinite(n) ? n : Number.NaN;
}

export interface ParseResult {
  holdings: Holding[];
  errors: string[];
}

/** Map a raw CSV into typed holdings, recording the source row for provenance. */
export function csvToHoldings(text: string): ParseResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length < 2) return { holdings: [], errors: ["File has no data rows."] };

  const header = rows[0].map(normHeader);
  const colOf = (field: keyof Holding): number =>
    header.findIndex((h) => HEADER_ALIASES[h] === field);

  const idx = {
    name: colOf("name"),
    lei: colOf("lei"),
    title: colOf("title"),
    cusip: colOf("cusip"),
    isin: colOf("isin"),
    ticker: colOf("ticker"),
    balance: colOf("balance"),
    units: colOf("units"),
    valueUsd: colOf("valueUsd"),
    pctOfNetAssets: colOf("pctOfNetAssets"),
    assetCategory: colOf("assetCategory"),
    issuerCategory: colOf("issuerCategory"),
    payoffProfile: colOf("payoffProfile"),
    country: colOf("country"),
    sector: colOf("sector"),
  };

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const holdings: Holding[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sourceRow = i + 1; // 1-indexed, accounting for header
    holdings.push({
      name: get(r, idx.name),
      lei: get(r, idx.lei) || null,
      title: get(r, idx.title) || get(r, idx.name),
      cusip: get(r, idx.cusip) || null,
      isin: get(r, idx.isin) || null,
      ticker: get(r, idx.ticker) || null,
      balance: num(get(r, idx.balance)),
      units: get(r, idx.units) || "NS",
      valueUsd: num(get(r, idx.valueUsd)),
      pctOfNetAssets: num(get(r, idx.pctOfNetAssets)),
      assetCategory: (get(r, idx.assetCategory) || "EC") as AssetCategory,
      issuerCategory: (get(r, idx.issuerCategory) || "CORP") as IssuerCategory,
      payoffProfile: (get(r, idx.payoffProfile) || "Long") as PayoffProfile,
      country: (get(r, idx.country) || "US").toUpperCase(),
      sector: get(r, idx.sector) || null,
      sourceRow,
    });
  }

  return { holdings, errors };
}
