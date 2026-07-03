import "server-only";
import { Resend } from "resend";

// Approval notifications. If RESEND_API_KEY is unset, we log instead of send so the
// demo runs with zero external config.
export async function sendApprovalEmail(input: {
  fundName: string;
  ticker: string;
  period: string;
  approver: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.FILING_NOTIFY_TO || "compliance@example.com";
  const subject = `N-PORT approved — ${input.ticker} ${input.period}`;
  const body = `${input.fundName} (${input.ticker}) N-PORT for ${input.period} was approved by ${input.approver} and is ready for EDGAR submission.`;

  if (!key) {
    console.log(`[email:stub] to=${to} :: ${subject} :: ${body}`);
    return { sent: false as const, reason: "no_api_key" };
  }
  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from: "N-PORT Studio <filings@corgi.example>",
      to,
      subject,
      text: body,
    });
    return { sent: true as const };
  } catch (e) {
    console.error("[email] send failed", e);
    return { sent: false as const, reason: "send_error" };
  }
}
