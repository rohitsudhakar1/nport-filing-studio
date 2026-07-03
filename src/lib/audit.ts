import { db } from "@/db";
import { auditEvents } from "@/db/schema";

/** Record an append-only audit event. Every state change in a filing flows through here. */
export async function logAudit(
  filingId: number | null,
  actor: string,
  action: string,
  detail?: string,
): Promise<void> {
  await db.insert(auditEvents).values({ filingId, actor, action, detail: detail ?? null });
}
