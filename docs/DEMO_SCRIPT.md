# Demo video script — target 75–90 seconds

**Prep before recording:** `npm run seed`, then import IVV via the UI so the workspace
shows both funds. Have the browser at http://localhost:3000, window ~1440px wide,
close other tabs. Record screen only — no webcam needed. Speak plainly and
unhurried; the cuts do the pacing.

| # | Time | On screen | Say |
|---|------|-----------|-----|
| 1 | 0:00–0:08 | Filing workspace (dashboard) | "This is N-PORT Filing Studio — ETF filing operations as software. Every fund, its deadlines, and what's blocking approval, on one screen." |
| 2 | 0:08–0:20 | Click **Import fund from EDGAR**, type `SCHD`, import; land on the filing page | "I can pull any real ETF straight from SEC EDGAR. It resolves the ticker, fetches the fund's two latest N-PORT filings, parses them, and loads the newest into review." |
| 3 | 0:20–0:32 | Scroll the IVV filing page (already imported): stamp, 507 positions, exceptions tab | "This is iShares' actual S&P 500 ETF — 507 holdings, 721 billion dollars. The rule engine flagged real anomalies in the filed document: a position with no identifier, and a duplicate CUSIP." |
| 4 | 0:32–0:40 | Click **Changes** tab on IVV | "And the period diff shows real index turnover against the prior quarter — six added, six removed." |
| 5 | 0:40–0:58 | Open CORG June draft. Point at the red stamp, then the CUSIP exception's **Suggested fix**; click **Apply fix** | "For our own fund's draft, validation caught a mistyped CUSIP. The tool did what an analyst would do — reconciled it against the last approved filing — and proposes the fix with its evidence. One click: data corrected, audit-logged, re-validated." |
| 6 | 0:58–1:10 | Apply remaining fixes quickly; click **Sign & approve…**; show the attestation modal; type a short attestation; sign. Stamp flips to green APPROVED | "Approval is a signing ceremony — you see exactly what you're attesting to, and the attestation goes into the audit trail. Errors block signing until they're actually resolved." |
| 7 | 1:10–1:20 | Click through to the public fund page (CORG or IVV) | "And the public fund page publishes only from approved filings — every number traces to a signed N-PORT, with its provenance printed on the page. Lighthouse 100s across the board." |
| 8 | 1:20–1:25 | Back on workspace, end frame | "Built in Corgi's stack — Next, TypeScript, Drizzle, Postgres. Thanks for watching." |

**Recording tips**
- Do one full silent dry run first so the EDGAR import (shot 2) is warm and quick.
- If the live EDGAR call is slow on camera, cut it in editing — the *result* is the point.
- Export at 1080p; keep the file under 100 MB (Loom or YouTube-unlisted both fine).
