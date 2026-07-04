"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { approveFiling, reopenFiling, revalidateFiling } from "@/app/actions";

export interface ApprovalSummary {
  holdings: number;
  totalPct: number;
  openErrors: number;
  openWarnings: number;
  added: number;
  removed: number;
  reweighted: number;
}

export function FilingActions({
  filingId,
  status,
  summary,
}: {
  filingId: number;
  status: string;
  summary: ApprovalSummary;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [showAttest, setShowAttest] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const router = useRouter();

  const run = (fn: () => Promise<void | { ok: boolean; error?: string }>) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (res && !res.ok) setMsg(res.error ?? "Action failed.");
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {msg && <span className="text-xs text-err max-w-[280px]">{msg}</span>}
      <button type="button" className="btn" onClick={() => setShowXml(true)}>
        Preview EDGAR XML
      </button>
      <button type="button" className="btn" disabled={pending} onClick={() => run(() => revalidateFiling(filingId))}>
        Re-validate
      </button>
      {status === "approved" ? (
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => run(() => reopenFiling(filingId, "Reopened for revision"))}
        >
          Reopen
        </button>
      ) : summary.openErrors > 0 ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-xs text-err">
            {summary.openErrors === 1
              ? "1 error blocks signing — fix or resolve it in Exceptions"
              : `${summary.openErrors} errors block signing — fix or resolve them in Exceptions`}
          </span>
          <button type="button" className="btn btn-accent" disabled>
            Sign &amp; approve…
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="btn btn-accent"
          disabled={pending}
          onClick={() => setShowAttest(true)}
        >
          Sign &amp; approve…
        </button>
      )}

      {showAttest && (
        <AttestModal
          filingId={filingId}
          summary={summary}
          onClose={() => setShowAttest(false)}
          onDone={() => {
            setShowAttest(false);
            router.refresh();
          }}
        />
      )}
      {showXml && <XmlDrawer filingId={filingId} onClose={() => setShowXml(false)} />}
    </div>
  );
}

/** Approval = signing a document: show exactly what is being signed, require a reason. */
function AttestModal({
  filingId,
  summary,
  onClose,
  onDone,
}: {
  filingId: number;
  summary: ApprovalSummary;
  onClose: () => void;
  onDone: () => void;
}) {
  const [attestation, setAttestation] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const rows: [string, string, boolean?][] = [
    ["Positions", String(summary.holdings)],
    ["Σ % of net assets", `${summary.totalPct.toFixed(2)}%`],
    ["Blocking errors", String(summary.openErrors), summary.openErrors > 0],
    ["Open warnings", String(summary.openWarnings), false],
    [
      "Changes vs. prior period",
      `${summary.added} added · ${summary.removed} removed · ${summary.reweighted} reweighted`,
    ],
  ];

  function sign() {
    if (!attestation.trim()) {
      setError("Write a short attestation — it becomes part of the audit record.");
      return;
    }
    start(async () => {
      const res = await approveFiling(filingId, attestation);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-md p-6 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label">Approval</div>
        <h3 className="font-display text-xl font-medium mt-1">Sign this filing</h3>
        <p className="text-sm text-muted mt-1">
          You are approving this N-PORT for EDGAR submission. This is what you're signing:
        </p>

        <dl className="mt-4 border rounded-md divide-y">
          {rows.map(([k, v, bad]) => (
            <div key={k} className="flex items-center justify-between px-3.5 py-2 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className={`num font-medium ${bad ? "text-err" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>

        <label className="label block mt-4 mb-1.5" htmlFor="attestation">
          Attestation (recorded in the audit trail)
        </label>
        <textarea
          id="attestation"
          rows={2}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="e.g. Reviewed all exceptions and period changes; identifiers reconciled against prior filing."
          value={attestation}
          onChange={(e) => setAttestation(e.target.value)}
        />
        {error && <p className="text-sm text-err mt-2">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn btn-accent" onClick={sign} disabled={pending}>
            {pending ? "Signing…" : "Sign & approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** In-app review of the exact EDGAR output, plus download. */
function XmlDrawer({ filingId, onClose }: { filingId: number; onClose: () => void }) {
  const [xml, setXml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/filings/${filingId}/xml`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => alive && setXml(t))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [filingId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-2xl h-full flex flex-col border-l"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <div className="label">EDGAR output</div>
            <h3 className="font-display text-lg font-medium">Form N-PORT XML</h3>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/api/filings/${filingId}/xml`} className="btn" download>
              Download
            </a>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5 bg-paper">
          {failed ? (
            <p className="text-sm text-err">Could not load the XML. Close and retry.</p>
          ) : xml === null ? (
            <p className="font-mono text-xs text-faint">Generating…</p>
          ) : (
            <pre className="font-mono text-[0.72rem] leading-relaxed whitespace-pre-wrap break-all text-ink">
              {xml}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
