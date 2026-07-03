import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { filings, holdings } from "@/db/schema";
import { rowToHolding } from "@/lib/filing-service";
import { generateNportXml } from "@/lib/nport-xml";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const filingId = Number(id);
  const filing = await db.query.filings.findFirst({ where: eq(filings.id, filingId) });
  if (!filing) return new NextResponse("Not found", { status: 404 });

  const fund = await db.query.funds.findFirst({
    where: (f, { eq: e }) => e(f.id, filing.fundId),
  });
  if (!fund) return new NextResponse("Fund not found", { status: 404 });

  const hRows = await db
    .select()
    .from(holdings)
    .where(eq(holdings.filingId, filingId))
    .orderBy(holdings.sourceRow);

  const xml = generateNportXml(
    {
      fundName: fund.name,
      ticker: fund.ticker,
      seriesId: fund.seriesId,
      lei: fund.lei,
      repPdDate: filing.repPdDate,
    },
    hRows.map(rowToHolding),
  );

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="NPORT_${fund.ticker}_${filing.period}.xml"`,
    },
  });
}
