import Link from "next/link";
import { notFound } from "next/navigation";
import { getFilingDetail } from "@/lib/filing-service";
import {
  filingDeadline,
  fmtDate,
  fmtDueDate,
  fmtPct,
  fmtUsd,
  periodLabel,
} from "@/lib/format";
import { FilingActions } from "./filing-actions";
import { FilingTabs } from "./filing-tabs";

export const dynamic = "force-dynamic";

export default async function FilingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getFilingDetail(Number(id));
  if (!detail) notFound();

  const { filing, fund, holdings, exceptions, audit, diff, priorPeriod } = detail;
  const totalValue = holdings.reduce((s, h) => s + (Number.isFinite(h.valueUsd) ? h.valueUsd : 0), 0);
  const totalPct = holdings.reduce(
    (s, h) => s + (Number.isFinite(h.pctOfNetAssets) ? h.pctOfNetAssets : 0),
    0,
  );
  const openErrors = exceptions.filter((e) => e.severity === "error" && e.status !== "resolved").length;
  const openWarnings = exceptions.filter(
    (e) => e.severity === "warning" && e.status !== "resolved",
  ).length;
  const dl = filingDeadline(filing.repPdDate);

  return (
    <div className="space-y-6">
      <Link href="/" className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-faint hover:text-ink">
        ← Filing workspace
      </Link>

      {/* Document cover sheet */}
      <div className="card px-6 py-5">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="label">Form NPORT-P · {fund.seriesId}</div>
            <h1 className="font-display text-[1.8rem] font-medium tracking-tight leading-tight mt-1">
              {fund.name}
            </h1>
            <div className="font-mono text-[0.72rem] text-muted mt-2 space-x-3">
              <span>{fund.ticker}</span>
              <span>period {filing.repPdDate}</span>
              <span>
                due {fmtDueDate(dl.due)}
                {filing.status !== "approved" &&
                  ` (${dl.daysLeft >= 0 ? `${dl.daysLeft}d left` : `${-dl.daysLeft}d overdue`})`}
              </span>
              <span className="text-faint">src {filing.sourceFilename ?? "—"}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {filing.status === "approved" ? (
              <span className="stamp stamp-ok">
                Approved
                <br />
                {filing.approvedAt ? fmtDate(filing.approvedAt) : ""} · {shortActor(filing.approvedBy)}
              </span>
            ) : openErrors > 0 ? (
              <span className="stamp stamp-err">
                Not ready
                <br />
                {openErrors} blocking error{openErrors === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="stamp stamp-draft">
                Draft
                <br />
                ready for approval
              </span>
            )}
          </div>
        </div>

        {/* Ledger figures line */}
        <div className="rule-double mt-5 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Figure label="Positions" value={String(holdings.length)} />
          <Figure label="Total value" value={fmtUsd(totalValue, true)} />
          <Figure
            label="Σ % net assets"
            value={fmtPct(totalPct)}
            tone={Math.abs(totalPct - 100) > 0.5 ? "warn" : undefined}
          />
          <Figure
            label="Open exceptions"
            value={`${openErrors + openWarnings}`}
            tone={openErrors > 0 ? "err" : openWarnings > 0 ? "warn" : "ok"}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">
          {periodLabel(filing.period)} schedule of portfolio investments
          {priorPeriod ? ` · compared against ${periodLabel(priorPeriod)}` : ""}
        </p>
        <FilingActions
          filingId={filing.id}
          status={filing.status}
          summary={{
            holdings: holdings.length,
            totalPct: Number(totalPct.toFixed(2)),
            openErrors,
            openWarnings,
            added: diff?.added ?? 0,
            removed: diff?.removed ?? 0,
            reweighted: diff?.weightChanged ?? 0,
          }}
        />
      </div>

      <FilingTabs
        filingId={filing.id}
        exceptions={exceptions.map((e) => ({
          id: e.id,
          code: e.code,
          severity: e.severity,
          message: e.message,
          holdingRow: e.holdingRow,
          field: e.field,
          status: e.status,
          note: e.note,
          resolvedBy: e.resolvedBy,
          suggestion: e.suggestion,
        }))}
        diff={diff}
        priorPeriod={priorPeriod}
        holdings={holdings}
        audit={audit.map((a) => ({
          id: a.id,
          actor: a.actor,
          action: a.action,
          detail: a.detail,
          createdAt: fmtDate(a.createdAt),
        }))}
      />
    </div>
  );
}

function shortActor(actor: string | null): string {
  if (!actor) return "";
  const at = actor.indexOf("@");
  return at > 0 ? actor.slice(0, at) : actor.split(" (")[0];
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "err" }) {
  const color =
    tone === "err" ? "text-err" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`num text-lg font-medium mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
