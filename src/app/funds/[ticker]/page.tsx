import Link from "next/link";
import { notFound } from "next/navigation";
import { getApprovedFilingForFund, getFundByTicker } from "@/lib/filing-service";
import { fmtDate, fmtPct, fmtUsd, periodLabel } from "@/lib/format";
import { ASSET_CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

const CHART_COLORS = [
  "#175e4c", "#274e79", "#8a5a12", "#5b3a75", "#a83226",
  "#0e6d70", "#6b5310", "#31567a", "#7a3b52", "#45536a",
];

export default async function FundPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const fund = await getFundByTicker(ticker);
  if (!fund) notFound();
  const approved = await getApprovedFilingForFund(fund.id);

  if (!approved) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <div className="label">No published data</div>
        <h1 className="font-display text-2xl font-medium mt-2">{fund.name}</h1>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          This page publishes only from approved filings — nothing appears here until a filing has
          been validated, reviewed, and signed. Approve a filing in the workspace to publish.
        </p>
        <Link href="/" className="link text-sm mt-4 inline-block">
          Go to the filing workspace →
        </Link>
      </div>
    );
  }

  const { filing, holdings } = approved;
  const totalValue = holdings.reduce((s, h) => s + h.valueUsd, 0);

  // Exposure: by sector when the data carries it, else by N-PORT asset category.
  const hasSectors = holdings.some((h) => h.sector);
  const byGroup = new Map<string, number>();
  for (const h of holdings) {
    const key = hasSectors
      ? (h.sector ?? "Other")
      : (ASSET_CATEGORIES[h.assetCategory] ?? h.assetCategory);
    byGroup.set(key, (byGroup.get(key) ?? 0) + h.pctOfNetAssets);
  }
  const groups = [...byGroup.entries()]
    .map(([name, pct]) => ({ name, pct }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10);

  const top = holdings.slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Certificate-style hero */}
      <div className="card px-8 py-7">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="label">
              {fund.seriesId} · LEI {fund.lei}
            </div>
            <h1 className="font-display text-[2.4rem] font-medium tracking-tight leading-[1.1] mt-1.5">
              {fund.name}
            </h1>
            <p className="font-display italic text-muted text-lg mt-1.5">
              Holdings as reported to the U.S. Securities and Exchange Commission.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="label">Net assets</div>
            <div className="font-display text-[2.1rem] font-medium leading-tight">
              {fmtUsd(totalValue, true)}
            </div>
            <div className="font-mono text-[0.68rem] text-faint mt-0.5">as of {filing.repPdDate}</div>
          </div>
        </div>

        {/* Provenance: the trust mechanism, stamped */}
        <div className="rule-double mt-6 pt-4 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted leading-relaxed max-w-xl">
            Every figure on this page traces to an approved Form N-PORT for{" "}
            {periodLabel(filing.period)} — source <span className="num">{filing.sourceFilename}</span>,
            approved by {filing.approvedBy}
            {filing.approvedAt ? ` on ${fmtDate(filing.approvedAt)}` : ""}.{" "}
            <Link href={`/filings/${filing.id}`} className="link">
              View the filing lineage →
            </Link>
          </p>
          <span className="stamp stamp-ok">
            Verified
            <br />
            {periodLabel(filing.period)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exposure */}
        <div className="card p-6 lg:col-span-1">
          <h2 className="font-display text-lg font-medium">
            {hasSectors ? "Sector exposure" : "Asset exposure"}
          </h2>
          <div className="flex justify-center my-5">
            <Donut groups={groups} />
          </div>
          <ul className="space-y-1.5">
            {groups.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <span className="dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="num text-muted">{fmtPct(s.pct, 1)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Top holdings */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Top 10 holdings</h2>
            <span className="font-mono text-[0.68rem] text-faint">
              {holdings.length} total positions
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Holding</th>
                <th className="th">Identifier</th>
                <th className="th text-right">Weight</th>
                <th className="th w-[28%]" />
              </tr>
            </thead>
            <tbody>
              {top.map((h) => (
                <tr key={h.sourceRow}>
                  <td className="td font-medium">{h.name}</td>
                  <td className="td num text-muted text-xs">{h.ticker ?? h.cusip ?? h.isin ?? "—"}</td>
                  <td className="td num text-right font-medium">{fmtPct(h.pctOfNetAssets)}</td>
                  <td className="td">
                    <div className="h-[7px] rounded-sm bg-line/70 overflow-hidden">
                      <div
                        className="h-full rounded-sm bg-accent"
                        style={{
                          width: `${Math.min(100, (h.pctOfNetAssets / top[0].pctOfNetAssets) * 100)}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="font-mono text-[0.68rem] text-faint leading-relaxed">
        Holdings are subject to change. Generated automatically from the fund's most recent
        approved regulatory filing. Illustrative demonstration — not investment advice.
      </p>
    </div>
  );
}

function Donut({ groups }: { groups: { name: string; pct: number }[] }) {
  const total = groups.reduce((s, x) => s + x.pct, 0) || 100;
  const R = 62;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg width="164" height="164" viewBox="0 0 164 164" role="img" aria-label="Exposure allocation chart">
      <title>Exposure allocation</title>
      <g transform="translate(82,82) rotate(-90)">
        {groups.map((s, i) => {
          const frac = s.pct / total;
          const len = frac * C;
          const seg = (
            <circle
              key={s.name}
              r={R}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth="15"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
      </g>
      <text
        x="82"
        y="79"
        textAnchor="middle"
        fontSize="15"
        fontWeight="600"
        fill="#0e1b2c"
        fontFamily="var(--font-mono)"
      >
        {groups.length}
      </text>
      <text x="82" y="95" textAnchor="middle" fontSize="9" fill="#5f6b80" fontFamily="var(--font-mono)">
        {groups.length === 1 ? "group" : "groups"}
      </text>
    </svg>
  );
}
