"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applyFix, setExceptionStatus } from "@/app/actions";
import type { FixSuggestion } from "@/lib/fixes";
import { SEVERITY_BADGE } from "@/lib/format";

export interface ExceptionVM {
  id: number;
  code: string;
  severity: string;
  message: string;
  holdingRow: number | null;
  field: string | null;
  status: string;
  note: string | null;
  resolvedBy: string | null;
  suggestion: FixSuggestion | null;
}

export function ExceptionRow({ exc, filingId }: { exc: ExceptionVM; filingId: number }) {
  const [note, setNote] = useState(exc.note ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const sev = SEVERITY_BADGE[exc.severity] ?? { cls: "badge-neutral", label: exc.severity };

  const update = (status: "open" | "acknowledged" | "resolved") =>
    start(async () => {
      await setExceptionStatus(exc.id, filingId, status, note);
      setEditing(false);
      router.refresh();
    });

  const runFix = () =>
    start(async () => {
      setError("");
      const res = await applyFix(exc.id, filingId);
      if (!res.ok) setError(res.error);
      router.refresh();
    });

  const resolved = exc.status === "resolved";

  return (
    <div className={`border rounded-md ${resolved ? "bg-ok-soft/40 opacity-75" : "bg-surface"}`}>
      <div className="flex items-start gap-3 p-3.5">
        <span className={`badge ${sev.cls} mt-0.5`}>{sev.label}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{exc.message}</span>
            <span className="badge badge-neutral">{exc.code}</span>
          </div>
          <div className="font-mono text-[0.68rem] text-faint mt-1">
            {exc.holdingRow ? `row ${exc.holdingRow}` : "filing-level"}
            {exc.field ? ` · ${exc.field}` : ""}
            {resolved && exc.resolvedBy ? ` · resolved by ${exc.resolvedBy}` : ""}
          </div>
          {exc.note && !editing && <div className="text-xs mt-1.5 text-muted italic">"{exc.note}"</div>}
          {editing && (
            <textarea
              className="w-full mt-2 border rounded-md px-2.5 py-1.5 text-sm"
              rows={2}
              placeholder="Resolution note — what changed, who confirmed, why acceptable…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
          {error && <p className="text-xs text-err mt-1.5">{error}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!resolved ? (
            <>
              {!editing && (
                <button type="button" className="btn text-xs py-1 px-2.5" onClick={() => setEditing(true)}>
                  Add note
                </button>
              )}
              <button
                type="button"
                className="btn text-xs py-1 px-2.5"
                disabled={pending}
                onClick={() => update("resolved")}
                title="Mark handled without changing data — the note becomes the evidence"
              >
                Resolve
              </button>
            </>
          ) : (
            <button type="button" className="btn text-xs py-1 px-2.5" disabled={pending} onClick={() => update("open")}>
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Suggested fix: the analyst's reconciliation, done by the tool. */}
      {!resolved && exc.suggestion && (
        <div className="border-t bg-accent-soft/60 px-3.5 py-3 flex items-start gap-3 rounded-b-md">
          <span className="badge badge-ok mt-0.5">Suggested fix</span>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[0.78rem]">
              <span className="line-through text-err/70">{exc.suggestion.currentValue}</span>
              <span className="text-faint px-2">→</span>
              <span className="font-semibold text-ok">{String(exc.suggestion.suggestedValue)}</span>
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed">{exc.suggestion.rationale}</p>
          </div>
          <button
            type="button"
            className="btn btn-accent text-xs py-1.5 px-3 shrink-0"
            disabled={pending}
            onClick={runFix}
          >
            {pending ? "Applying…" : "Apply fix"}
          </button>
        </div>
      )}
    </div>
  );
}
