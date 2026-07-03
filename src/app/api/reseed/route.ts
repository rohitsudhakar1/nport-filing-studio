import { type NextRequest, NextResponse } from "next/server";
import { importFromEdgar } from "@/app/actions";
import { seedDemoData } from "@/db/seed-data";

export const maxDuration = 60; // EDGAR fetches take a few seconds each

/**
 * Nightly demo reset (Vercel cron). Restores the CORG walkthrough state, then
 * re-imports a couple of real funds from EDGAR so the hosted demo always has live
 * regulatory data on screen. Protected by CRON_SECRET (Vercel sends it as a Bearer
 * token on cron invocations).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const log: string[] = [await seedDemoData()];

  // EDGAR occasionally throttles datacenter IPs — the demo must not depend on this.
  for (const ticker of ["IVV", "SCHD"]) {
    try {
      const res = await importFromEdgar(ticker);
      log.push(res.ok ? `Imported ${ticker} (${res.fundName})` : `${ticker}: ${res.error}`);
    } catch (e) {
      log.push(`${ticker}: import failed (${e instanceof Error ? e.message : "unknown"})`);
    }
  }

  return NextResponse.json({ ok: true, log });
}
