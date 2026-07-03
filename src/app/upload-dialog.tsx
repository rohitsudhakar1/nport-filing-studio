"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ingestCsv } from "./actions";

interface FundOpt {
  id: number;
  name: string;
  ticker: string;
}

export function UploadDialog({ funds }: { funds: FundOpt[] }) {
  const [open, setOpen] = useState(false);
  const [fundId, setFundId] = useState(funds[0]?.id ?? 0);
  const [period, setPeriod] = useState("2026-07");
  const [repPdDate, setRepPdDate] = useState("2026-07-31");
  const [filename, setFilename] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    file.text().then(setCsv);
  }

  function submit() {
    setError("");
    if (!csv) {
      setError("Choose a holdings CSV first.");
      return;
    }
    start(async () => {
      const res = await ingestCsv({ fundId, period, repPdDate, filename: filename || "upload.csv", csv });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/filings/${res.filingId}`);
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        New filing from CSV
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setOpen(false)}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="label">Fund-admin upload</div>
        <h3 className="font-display text-xl font-medium mt-1">New filing from holdings CSV</h3>
        <p className="text-sm text-muted mt-1">
          Upload a fund-admin holdings export. Columns are auto-mapped (name, cusip, isin, value,
          weight, asset/issuer category, …). It's validated on ingest.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="label block mb-1.5">Fund</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-surface"
              value={fundId}
              onChange={(e) => setFundId(Number(e.target.value))}
            >
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.ticker})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1.5">Period (YYYY-MM)</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm num"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            <div>
              <label className="label block mb-1.5">Reporting date</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm num"
                value={repPdDate}
                onChange={(e) => setRepPdDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label block mb-1.5">Holdings CSV</label>
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
            {filename && <p className="text-xs text-muted mt-1 num">{filename}</p>}
            <a href="/sample_holdings.csv" download className="link text-xs mt-1 inline-block">
              Download a sample CSV ↓
            </a>
          </div>
          {error && <p className="text-sm text-err">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-accent" onClick={submit} disabled={pending}>
            {pending ? "Ingesting…" : "Ingest & validate"}
          </button>
        </div>
      </div>
    </div>
  );
}
