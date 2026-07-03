import Link from "next/link";
import { getDashboard } from "@/lib/filing-service";
import { filingDeadline, fmtDueDate, periodLabel, STATUS_BADGE } from "@/lib/format";
import { EdgarImportDialog } from "./edgar-import-dialog";
import { UploadDialog } from "./upload-dialog";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboard();
  const allFilings = data.flatMap((d) => d.filings);
  const drafts = allFilings.filter((f) => f.status !== "approved");
  const openErrors = drafts.reduce((s, f) => s + f.errorCount, 0);

  // The soonest N-PORT deadline among unapproved filings.
  const nextDue = drafts
    .map((f) => ({ f, ...filingDeadline(f.repPdDate) }))
    .sort((a, b) => a.due.getTime() - b.due.getTime())[0];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[2.1rem] font-medium tracking-tight leading-tight">
            Filing workspace
          </h1>
          <p className="text-muted text-[0.9rem] mt-1 max-w-xl">
            Every fund's N-PORT pipeline: ingest holdings, validate, review what changed, approve
            with attestation, and export EDGAR-ready output.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UploadDialog
            funds={data.map((d) => ({ id: d.fund.id, name: d.fund.name, ticker: d.fund.ticker }))}
          />
          <EdgarImportDialog />
        </div>
      </div>

      {/* Ledger summary line */}
      <div className="card grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
        <Stat
          label="Next deadline"
          value={nextDue ? fmtDueDate(nextDue.due) : "—"}
          detail={
            nextDue
              ? nextDue.daysLeft >= 0
                ? `${periodLabel(nextDue.f.period)} N-PORT · ${nextDue.daysLeft} days left`
                : `${periodLabel(nextDue.f.period)} N-PORT · ${-nextDue.daysLeft} days overdue`
              : "All filings approved"
          }
          tone={nextDue && nextDue.daysLeft < 10 ? "warn" : undefined}
        />
        <Stat
          label="In review"
          value={String(drafts.length)}
          detail={drafts.length === 1 ? "filing awaiting approval" : "filings awaiting approval"}
        />
        <Stat
          label="Open errors"
          value={String(openErrors)}
          detail={openErrors === 0 ? "nothing blocks approval" : "must be resolved to approve"}
          tone={openErrors > 0 ? "err" : "ok"}
        />
      </div>

      {data.map((d) => (
        <section key={d.fund.id} className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-lg font-medium">{d.fund.name}</h2>
              <span className="badge badge-neutral">{d.fund.ticker}</span>
              <Link href={`/funds/${d.fund.ticker}`} className="link text-xs">
                Public page →
              </Link>
            </div>
            <div className="font-mono text-[0.68rem] text-faint">
              {d.fund.seriesId} · LEI {d.fund.lei}
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Period</th>
                <th className="th">Status</th>
                <th className="th">Deadline</th>
                <th className="th text-right">Errors</th>
                <th className="th text-right">Warnings</th>
                <th className="th">Source</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {d.filings.map((f) => {
                const dl = filingDeadline(f.repPdDate);
                return (
                  <tr key={f.id}>
                    <td className="td font-medium">{periodLabel(f.period)}</td>
                    <td className="td">
                      <span className={`badge ${STATUS_BADGE[f.status]?.cls ?? "badge-neutral"}`}>
                        {STATUS_BADGE[f.status]?.label ?? f.status}
                      </span>
                    </td>
                    <td className="td">
                      {f.status === "approved" ? (
                        <span className="text-faint text-xs">filed</span>
                      ) : (
                        <span
                          className={`num text-xs ${
                            dl.daysLeft < 0
                              ? "text-err font-semibold"
                              : dl.daysLeft < 10
                                ? "text-warn font-semibold"
                                : "text-muted"
                          }`}
                        >
                          {fmtDueDate(dl.due)} ·{" "}
                          {dl.daysLeft >= 0 ? `${dl.daysLeft}d left` : `${-dl.daysLeft}d overdue`}
                        </span>
                      )}
                    </td>
                    <td
                      className={`td num text-right ${f.errorCount ? "text-err font-semibold" : "text-faint"}`}
                    >
                      {f.errorCount}
                    </td>
                    <td className={`td num text-right ${f.warningCount ? "text-warn" : "text-faint"}`}>
                      {f.warningCount}
                    </td>
                    <td className="td num text-[0.7rem] text-muted max-w-[220px] truncate">
                      {f.sourceFilename ?? "—"}
                    </td>
                    <td className="td text-right">
                      <Link href={`/filings/${f.id}`} className="link">
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "ok" | "warn" | "err";
}) {
  const color =
    tone === "err" ? "text-err" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div className="px-5 py-4">
      <div className="label">{label}</div>
      <div className={`font-display text-[1.9rem] font-medium leading-tight mt-1 ${color}`}>
        {value}
      </div>
      <div className="text-xs text-faint mt-0.5">{detail}</div>
    </div>
  );
}
