# N-PORT Filing Studio — Demo Video Script

**Runtime target:** 80–95 seconds · **Record against:** https://nport-filing-studio.vercel.app

---

## Pre-flight checklist (before pressing record)

1. Chrome, one window, no other tabs, bookmarks bar hidden (Ctrl+Shift+B)
2. Open https://nport-filing-studio.vercel.app
3. Dry run (not recorded): Import fund from EDGAR → type SPLG → import → click Filings to go home. Do not touch CORG.
4. Script on your phone, not on screen
5. Recorder: Loom ("Screen only") or Win+Alt+R
6. Notifications off (Focus assist)
7. Mouse discipline: move the cursor only to click; park it in empty space otherwise. Never wiggle.

---

## SHOT 1 — The workspace (~10 s)

**DO:** Nothing. You are on the homepage. Cursor parked.

**SAY:** "This is N-PORT Filing Studio — ETF filing operations as software. Every fund, its deadlines, and what's blocking approval, on one screen."

---

## SHOT 2 — Live import from EDGAR (~18 s)

**DO:**

1. Click the green **Import fund from EDGAR** button (top right)
2. Click into the FUND TICKER box
3. Type **VOO** slowly
4. Click **Import filings**
5. Wait through "Fetching from EDGAR…" — keep talking

**SAY (start while typing):** "I can pull any real ETF straight from SEC EDGAR. It resolves the ticker, fetches the fund's two most recent N-PORT filings, parses them, and loads the newest into review… this is Vanguard's S&P 500 fund — their actual filed data."

**You'll see:** the Vanguard S&P 500 ETF filing page — hundreds of positions, real dollar total.

**If the import fails:** click Cancel → Filings → open iShares Core S&P 500 ETF → Mar 2026 instead, and say "here's BlackRock's actual filed data."

---

## SHOT 3 — The suggested fix (~22 s)

**DO:**

1. Click **FILINGS** in the top nav
2. Under Corgi US Innovation ETF, on the **Jun 2026 / DRAFT** row, click **Open →**
3. Rest the cursor near the red **NOT READY / 2 BLOCKING ERRORS** stamp (don't click)
4. Move the cursor to the first exception's green **SUGGESTED FIX** panel
5. Click **Apply fix**

**SAY (matching the movements):**

- (cursor on stamp) "Our own fund's June draft isn't ready — validation found a mistyped CUSIP; the check digit doesn't validate."
- (cursor on fix panel) "The tool did what an analyst would do by hand: reconciled the row against the last approved filing, and proposes the fix with its evidence."
- (click Apply fix) "One click — data corrected, audit-logged, re-validated."

**You'll see:** Exceptions drop 4 → 3; the hint changes to "1 error blocks signing."

---

## SHOT 4 — The gate, then signing (~25 s)

**DO:**

1. Rest cursor on the red text: "1 error blocks signing — fix or resolve it in Exceptions"
2. Click **Apply fix** on the remaining error (XYZ → EC)
3. Watch the stamp flip to dashed **DRAFT / READY FOR APPROVAL**
4. Click **Sign & approve…**
5. Pause one second on the "Sign this filing" summary
6. Type in the attestation box: *Exceptions reviewed; identifiers reconciled against May filing.*
7. Click **Sign & approve**

**SAY (matching):**

- (cursor on red text) "Notice signing is blocked — you cannot approve a filing that still has unresolved errors."
- (apply fix) "Fix the last one… and it unlocks."
- (modal open, typing) "Approval is a signing ceremony: it shows exactly what you're attesting to — positions, weights, what changed since last month — and requires a written attestation that becomes part of the audit record."
- (click Sign) "Signed."

**You'll see:** the green **APPROVED** stamp with today's date and "· YOU".

---

## SHOT 5 — The public fund page (~12 s)

**DO:**

1. Click **FILINGS** in the top nav
2. On the Corgi fund header, click **Public page →**
3. Scroll down slowly once — provenance line, VERIFIED stamp, holdings table

**SAY:** "And the moment it's signed, the public fund page updates — it publishes only from approved filings. Every number an investor sees traces back to a signed N-PORT, with its provenance printed right on the page."

---

## SHOT 6 — Wrap the demo (~5 s)

**DO:** Click the **N-PORT Filing Studio** wordmark (top left). Park the cursor.

**SAY:** "Built in Corgi's stack — Next, TypeScript, Drizzle, Postgres — on live SEC data."

---

## SHOT 7 — Why Corgi (~20 s)

**DO:** Stay on the workspace screen, cursor parked. (If you're comfortable on camera, this is
the one moment where switching to webcam works well — optional.) Speak a touch slower here;
this is the personal part. Stop recording after the last line.

**SAY:**

"Quick note on why I want to build this with you. Almost everything I've worked on has been
financial data — a categorization pipeline processing over a million banking records at a
capital firm, client-management systems, audit and moderation tooling. The pattern is always
the same one you're attacking: critical workflows held together by spreadsheets and email.

Building this — reading the actual N-PORT spec, watching a validator catch real anomalies in
a real 700-billion-dollar fund's filing — was genuinely fun. This is exactly the kind of
end-to-end ownership I want: backend correctness, real regulatory constraints, and interfaces
people rely on. I'd love to do it for real at Corgi. Thanks for watching."

**Delivery notes:** don't rush, don't read robotically — say it like you'd tell a friend.
If it takes two takes, that's normal. Total video should land around 1:45–2:00 with this
closer, which is still well within a reviewer's patience.

---

## After recording

- Watch once; trim head/tail in Loom. Don't chase perfection — a real 90-second take beats a polished 5-minute one.
- The take approves the CORG draft — reset the demo afterwards so the next viewer finds it in draft state.
- If you flub a line: pause two seconds, redo the sentence, cut the gap later — or leave it.
