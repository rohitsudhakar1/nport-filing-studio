import "server-only";
import { XMLParser } from "fast-xml-parser";
import type { AssetCategory, Holding, IssuerCategory, PayoffProfile } from "@/lib/types";

// SEC EDGAR client. All endpoints are public; the SEC only asks for a descriptive
// User-Agent. Chain: ticker -> (cik, seriesId) -> NPORT-P filing index for that series
// -> primary_doc.xml -> typed holdings.

const UA = process.env.SEC_USER_AGENT ?? "NPortFilingStudio/0.1 (demo@example.com)";

async function edgarFetch(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Encoding": "gzip" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`EDGAR ${res.status} for ${url}`);
  return res;
}

export interface FundRef {
  cik: number;
  seriesId: string;
  classId: string;
  symbol: string;
}

// The ticker file is ~6MB and changes rarely; cache it for the process lifetime.
let tickerCache: { fields: string[]; data: [number, string, string, string][] } | null = null;

/** Resolve an ETF/mutual-fund ticker to its CIK + EDGAR series id. */
export async function resolveFund(ticker: string): Promise<FundRef | null> {
  if (!tickerCache) {
    const res = await edgarFetch("https://www.sec.gov/files/company_tickers_mf.json");
    tickerCache = await res.json();
  }
  const t = ticker.trim().toUpperCase();
  const row = tickerCache?.data.find((r) => r[3] === t);
  if (!row) return null;
  return { cik: row[0], seriesId: row[1], classId: row[2], symbol: row[3] };
}

export interface FilingRef {
  accession: string;
  filingDate: string;
}

/** List recent NPORT-P filings for a specific fund series (newest first). */
export async function listNportFilings(seriesId: string, count = 4): Promise<FilingRef[]> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${seriesId}&type=NPORT-P&count=${count}&output=atom`;
  const res = await edgarFetch(url);
  const xml = await res.text();
  const refs: FilingRef[] = [];
  const re = /<accession-number>([\d-]+)<\/accession-number>[\s\S]*?<filing-date>([\d-]+)<\/filing-date>/g;
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null && refs.length < count) {
    refs.push({ accession: m[1], filingDate: m[2] });
    m = re.exec(xml);
  }
  return refs;
}

export interface ParsedNport {
  regName: string;
  seriesName: string;
  seriesId: string;
  seriesLei: string;
  repPdEnd: string; // YYYY-MM-DD
  totAssets: number;
  holdings: Holding[];
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Fetch and parse one NPORT-P primary document into typed holdings. */
export async function fetchNport(cik: number, accession: string): Promise<ParsedNport> {
  const acc = accession.replace(/-/g, "");
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/primary_doc.xml`;
  const res = await edgarFetch(url);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false, // keep everything as strings; we coerce numbers ourselves
    removeNSPrefix: true,
  });
  const doc = parser.parse(xml);
  const formData = doc?.edgarSubmission?.formData;
  if (!formData) throw new Error("Unexpected N-PORT structure: missing formData");

  const gen = formData.genInfo ?? {};
  const fund = formData.fundInfo ?? {};
  const secs = asArray(formData.invstOrSecs?.invstOrSec);

  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.NaN;
  };
  const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v).trim());

  const holdings: Holding[] = secs.map((s: Record<string, unknown>, i: number) => {
    const ids = (s.identifiers ?? {}) as Record<string, unknown>;
    const isinAttr = (ids.isin as Record<string, unknown> | undefined)?.["@_value"];
    const cusip = str(s.cusip);
    const lei = str(s.lei);
    return {
      name: str(s.name) || "Unknown issuer",
      lei: lei && lei.toUpperCase() !== "N/A" ? lei : null, // filings use literal "N/A"
      title: str(s.title) || str(s.name),
      cusip: cusip && cusip !== "N/A" && cusip !== "000000000" ? cusip : null,
      isin: isinAttr ? str(isinAttr) : null,
      ticker: null, // N-PORT does not carry exchange tickers
      balance: num(s.balance),
      units: str(s.units) || "NS",
      valueUsd: num(s.valUSD),
      pctOfNetAssets: num(s.pctVal),
      assetCategory: (str(s.assetCat) || "EC") as AssetCategory,
      issuerCategory: (str(s.issuerCat) || "CORP") as IssuerCategory,
      payoffProfile: (str(s.payoffProfile) || "Long") as PayoffProfile,
      country: (str(s.invCountry) || "US").slice(0, 2).toUpperCase(),
      sector: null, // not present in N-PORT; UI falls back to asset category
      sourceRow: i + 2,
    };
  });

  return {
    regName: str(gen.regName),
    seriesName: str(gen.seriesName) || str(gen.regName),
    seriesId: str(gen.seriesId) || "",
    seriesLei: str(gen.seriesLei) || str(gen.regLei) || "",
    // N-PORT has TWO period fields: repPdEnd is the fund's fiscal-year end (identical
    // across a year's filings); repPdDate is the as-of date of THIS report. Use the latter.
    repPdEnd: str(gen.repPdDate) || str(gen.repPdEnd),
    totAssets: num(fund.totAssets ?? gen.totAssets),
    holdings,
  };
}
