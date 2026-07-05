# Demo video script — target ~75 seconds

**Setup:** record against the live site (https://nport-filing-studio.vercel.app), browser
window ~1440px wide, other tabs closed. Screen-only, no webcam needed. Do one silent
dry run first — it warms the EDGAR fetch and the serverless functions so nothing lags
on camera. If you demo'd fixes recently, hit reseed (or wait for the nightly cron) so
the CORG draft has its defects back.

| # | Time | Do | Say |
|---|------|----|-----|
| 1 | 0:00–0:10 | Land on the Filing workspace. Hover nothing; let it breathe. | "This is N-PORT Filing Studio — ETF filing operations as software. Every fund, its deadlines, and what's blocking approval, on one screen." |
| 2 | 0:10–0:25 | Click **Import fund from EDGAR**, type `VOO`, click Import. Land on the imported filing. | "I can pull any real ETF straight from SEC EDGAR — it resolves the ticker, fetches the fund's two most recent N-PORT filings, parses them, and loads the newest into review. This is Vanguard's actual filed data." |
| 3 | 0:25–0:45 | Go to the **CORG Jun 2026** draft → Exceptions tab. Point at the red NOT READY stamp, then the CUSIP exception's **Suggested fix**. Click **Apply fix**. | "Our own fund's draft has a mistyped CUSIP — the check digit doesn't validate. The tool did what an analyst would do: reconciled it against the last approved filing, and proposes the fix with its evidence. One click — data corrected, audit-logged, re-validated." |
| 4 | 0:45–1:00 | Point at the red "errors block signing" hint, apply the second fix, watch the stamp flip to READY. Click **Sign & approve…**, type a one-line attestation, sign. Green APPROVED stamp. | "Signing is blocked until every error is actually resolved. Now that it's clean — approval is a signing ceremony: you see exactly what you're attesting to, and the attestation goes into the audit trail." |
| 5 | 1:00–1:12 | Click through to the **public fund page** (CORG or IVV). Point at the provenance line + VERIFIED stamp. | "And the public fund page publishes only from approved filings — every number an investor sees traces back to a signed N-PORT, with its provenance printed on the page." |
| 6 | 1:12–1:16 | Cut back to the workspace. End. | "Built in Corgi's stack — Next, TypeScript, Drizzle, Postgres. Thanks for watching." |

**Don't show:** XML preview, CSV upload, audit-trail tab, SCHD — they dilute. The video's
only job is landing these five beats; reviewers who want more will click the live link.

**Recording:** Loom or unlisted YouTube, 1080p. If the EDGAR import stalls on camera,
cut the wait in editing — the result is the point, not the spinner.
