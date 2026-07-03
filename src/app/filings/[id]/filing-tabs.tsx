"use client";

import { useState } from "react";
import type { DiffSummary, Holding } from "@/lib/types";
import { fmtDelta, fmtNum, fmtPct, fmtUsd } from "@/lib/format";
import { type ExceptionVM, ExceptionRow } from "./exception-row";

export interface AuditVM {
  id: number;
  actor: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

type Tab = "exceptions" | "changes" | "holdings" | "audit";

export function FilingTabs({
  filingId,
  exceptions,
  diff,
  priorPeriod,
  holdings,
  audit,
}: {
  filingId: number;
  exceptions: ExceptionVM[];
  diff: DiffSummary | null;
  priorPeriod: string | null;
  holdings: Holding[];
  audit: AuditVM[];
}) {
  const [tab, setTab] = useState<Tab>("exceptions");
  const openCount = exceptions.filter((e) => e.status !== "resolved").length;
  const changeCount = diff ? diff.added + diff.removed + diff.weightChanged : 0;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "exceptions", label: "Exceptions", count: openCount },
    { id: "changes", label: "Changes", count: changeCount },
    { id: "holdings", label: "Holdings", count: holdings.length },
    { id: "audit", label: "Audit trail", count: audit.length },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="flex border-b bg-paper/60 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 font-mono text-[0.72rem] uppercase tracking-[0.08em] border-b-2 -mb-px transition whitespace-nowrap ${
              tab === t.id
                ? "border-accent text-ink font-semibold"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-faint">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "exceptions" && <ExceptionsTab exceptions={exceptions} filingId={filingId} />}
        {tab === "changes" && <ChangesTab diff={diff} priorPeriod={priorPeriod} />}
        {tab === "holdings" && <HoldingsTab holdings={holdings} />}
        {tab === "audit" && <AuditTab audit={audit} />}
      </div>
    </div>
  );
}

function ExceptionsTab({ exceptions, filingId }: { exceptions: ExceptionVM[]; filingId: number }) {
  if (exceptions.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-ok text-2xl">✓</div>
        <p className="font-medium mt-2">No validation exceptions</p>
        <p className="text-sm text-muted">Every holding passed the N-PORT rule checks.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {exceptions.map((e) => (
        <ExceptionRow key={e.id} exc={e} filingId={filingId} />
      ))}
    </div>
  );
}

function ChangesTab({ diff, priorPeriod }: { diff: DiffSummary | null; priorPeriod: string | null }) {
  if (!diff) {
    return <p className="text-sm text-muted py-6 text-center">No prior filing to compare against.</p>;
  }
  const allChanged = diff.rows.filter((r) => r.kind !== "unchanged");
  const rows = allChanged.slice(0, 120);
  return (
    <div>
      <div className="flex gap-6 mb-4 text-sm">
        <span className="text-muted">
          vs. <span className="font-medium text-ink">{priorPeriod}</span>
        </span>
        <span className="text-ok">▲ {diff.added} added</span>
        <span className="text-err">▼ {diff.removed} removed</span>
        <span className="text-warn">↕ {diff.weightChanged} reweighted</span>
        <span className="text-faint">{diff.unchanged} unchanged</span>
      </div>
      {allChanged.length > rows.length && (
        <p className="font-mono text-[0.7rem] text-faint mb-3">
          Showing the {rows.length} largest moves of {allChanged.length} changes.
        </p>
      )}
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Change</th>
            <th className="th">Holding</th>
            <th className="th text-right">Prior %</th>
            <th className="th text-right">Current %</th>
            <th className="th text-right">Δ (pts)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="td">
                <ChangeBadge kind={r.kind} />
              </td>
              <td className="td font-medium">{r.name}</td>
              <td className="td num text-right text-muted">{r.priorPct === null ? "—" : fmtPct(r.priorPct)}</td>
              <td className="td num text-right">{r.currentPct === null ? "—" : fmtPct(r.currentPct)}</td>
              <td
                className={`td num text-right font-medium ${
                  (r.deltaPct ?? 0) > 0 ? "text-ok" : (r.deltaPct ?? 0) < 0 ? "text-err" : "text-faint"
                }`}
              >
                {fmtDelta(r.deltaPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeBadge({ kind }: { kind: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    added: { cls: "badge-ok", label: "Added" },
    removed: { cls: "badge-err", label: "Removed" },
    weight_change: { cls: "badge-warn", label: "Reweighted" },
  };
  const b = map[kind] ?? { cls: "badge-neutral", label: kind };
  return <span className={`badge ${b.cls}`}>{b.label}</span>;
}

const HOLDINGS_RENDER_CAP = 150;

function HoldingsTab({ holdings: all }: { holdings: Holding[] }) {
  const holdings = all.slice(0, HOLDINGS_RENDER_CAP);
  return (
    <div className="overflow-x-auto">
      {all.length > HOLDINGS_RENDER_CAP && (
        <p className="font-mono text-[0.7rem] text-faint mb-3">
          Showing the {HOLDINGS_RENDER_CAP} largest of {all.length} positions — the full schedule is
          in the EDGAR XML export.
        </p>
      )}
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">#</th>
            <th className="th">Name</th>
            <th className="th">CUSIP</th>
            <th className="th">ISIN / Ticker</th>
            <th className="th">Cat</th>
            <th className="th text-right">Balance</th>
            <th className="th text-right">Value</th>
            <th className="th text-right">% NA</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.sourceRow}>
              <td className="td num text-faint">{h.sourceRow}</td>
              <td className="td font-medium">{h.name}</td>
              <td className="td num text-muted">{h.cusip ?? "—"}</td>
              <td className="td num text-muted">{h.ticker ?? h.isin ?? "—"}</td>
              <td className="td num text-xs text-muted">{h.assetCategory}</td>
              <td className="td num text-right text-muted">{fmtNum(h.balance)}</td>
              <td className="td num text-right">{fmtUsd(h.valueUsd)}</td>
              <td className="td num text-right font-medium">{fmtPct(h.pctOfNetAssets)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab({ audit }: { audit: AuditVM[] }) {
  return (
    <ol className="relative border-l ml-2 space-y-4 py-1">
      {audit.map((a) => (
        <li key={a.id} className="ml-5">
          <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-accent border-2 border-surface" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-neutral num">{a.action}</span>
            <span className="text-sm font-medium">{a.actor}</span>
            <span className="text-xs text-faint num">{a.createdAt}</span>
          </div>
          {a.detail && <p className="text-sm text-muted mt-0.5">{a.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
