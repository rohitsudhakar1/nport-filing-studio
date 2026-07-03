import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const funds = pgTable("funds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ticker: varchar("ticker", { length: 12 }).notNull().unique(),
  seriesId: varchar("series_id", { length: 20 }).notNull(),
  lei: varchar("lei", { length: 20 }).notNull(),
  cik: varchar("cik", { length: 10 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** status lifecycle: draft -> in_review -> approved (or rejected back to draft). */
export const filings = pgTable(
  "filings",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
    repPdDate: varchar("rep_pd_date", { length: 10 }).notNull(), // reporting period end
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    sourceFilename: text("source_filename"),
    errorCount: integer("error_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ fundIdx: index("filings_fund_idx").on(t.fundId) }),
);

export const holdings = pgTable(
  "holdings",
  {
    id: serial("id").primaryKey(),
    filingId: integer("filing_id")
      .notNull()
      .references(() => filings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    lei: varchar("lei", { length: 20 }),
    title: text("title").notNull(),
    cusip: varchar("cusip", { length: 9 }),
    isin: varchar("isin", { length: 12 }),
    ticker: varchar("ticker", { length: 12 }),
    balance: doublePrecision("balance").notNull(),
    units: varchar("units", { length: 8 }).notNull(),
    valueUsd: doublePrecision("value_usd").notNull(),
    pctOfNetAssets: doublePrecision("pct_of_net_assets").notNull(),
    assetCategory: varchar("asset_category", { length: 8 }).notNull(),
    issuerCategory: varchar("issuer_category", { length: 8 }).notNull(),
    payoffProfile: varchar("payoff_profile", { length: 8 }).notNull(),
    country: varchar("country", { length: 2 }).notNull(),
    sector: text("sector"),
    sourceRow: integer("source_row").notNull(),
  },
  (t) => ({ filingIdx: index("holdings_filing_idx").on(t.filingId) }),
);

export const exceptions = pgTable(
  "exceptions",
  {
    id: serial("id").primaryKey(),
    filingId: integer("filing_id")
      .notNull()
      .references(() => filings.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    severity: varchar("severity", { length: 8 }).notNull(),
    message: text("message").notNull(),
    holdingRow: integer("holding_row"),
    field: varchar("field", { length: 32 }),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    note: text("note"),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => ({ filingIdx: index("exceptions_filing_idx").on(t.filingId) }),
);

/** Append-only audit trail — the compliance evidence-capture surface. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    filingId: integer("filing_id").references(() => filings.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    action: varchar("action", { length: 48 }).notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ filingIdx: index("audit_filing_idx").on(t.filingId) }),
);

export const fundsRelations = relations(funds, ({ many }) => ({ filings: many(filings) }));
export const filingsRelations = relations(filings, ({ one, many }) => ({
  fund: one(funds, { fields: [filings.fundId], references: [funds.id] }),
  holdings: many(holdings),
  exceptions: many(exceptions),
  auditEvents: many(auditEvents),
}));
export const holdingsRelations = relations(holdings, ({ one }) => ({
  filing: one(filings, { fields: [holdings.filingId], references: [filings.id] }),
}));

export type FundRow = typeof funds.$inferSelect;
export type FilingRow = typeof filings.$inferSelect;
export type HoldingRow = typeof holdings.$inferSelect;
export type ExceptionRow = typeof exceptions.$inferSelect;
export type AuditRow = typeof auditEvents.$inferSelect;
