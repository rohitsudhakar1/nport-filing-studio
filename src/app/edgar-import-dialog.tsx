"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importFromEdgar } from "./actions";

const EXAMPLES = ["IVV", "QQQM", "SCHD", "VTI"];

export function EdgarImportDialog() {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(t: string) {
    const symbol = (t || ticker).trim().toUpperCase();
    if (!symbol) {
      setError("Enter a fund ticker.");
      return;
    }
    setError("");
    start(async () => {
      const res = await importFromEdgar(symbol);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/filings/${res.filingId}`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-accent" onClick={() => setOpen(true)}>
        Import fund from EDGAR
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={() => !pending && setOpen(false)}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="label">SEC EDGAR</div>
        <h3 className="font-display text-xl font-medium mt-1">Import a real fund</h3>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          Enter any ETF ticker. The two most recent Form N-PORT filings are pulled from EDGAR,
          parsed, and loaded — the earlier as approved reference data, the latest into the review
          queue with validation and a period-over-period diff.
        </p>

        <div className="mt-5">
          <label className="label block mb-1.5" htmlFor="edgar-ticker">
            Fund ticker
          </label>
          <input
            id="edgar-ticker"
            className="w-full border rounded-md px-3 py-2 num uppercase"
            placeholder="IVV"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(ticker)}
            disabled={pending}
          />
          <div className="flex items-center gap-1.5 mt-2 text-xs text-faint">
            try:
            {EXAMPLES.map((t) => (
              <button
                key={t}
                type="button"
                className="num underline underline-offset-2 hover:text-ink"
                onClick={() => {
                  setTicker(t);
                  submit(t);
                }}
                disabled={pending}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-err mt-3">{error}</p>}
        {pending && (
          <p className="text-sm text-muted mt-3">
            Fetching from EDGAR — parsing two filings, this takes a few seconds…
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn btn-accent" onClick={() => submit(ticker)} disabled={pending}>
            {pending ? "Importing…" : "Import filings"}
          </button>
        </div>
      </div>
    </div>
  );
}
