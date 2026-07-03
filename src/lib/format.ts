export function fmtUsd(n: number, compact = false): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
}

export function fmtPct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function fmtDelta(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

export function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m)]} ${y}`;
}

/** Form N-PORT is due within 30 days after the end of the reporting period. */
export function filingDeadline(repPdDate: string): { due: Date; daysLeft: number } {
  const end = new Date(`${repPdDate}T00:00:00`);
  const due = new Date(end);
  due.setDate(due.getDate() + 30);
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  return { due, daysLeft };
}

export function fmtDueDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

export const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  draft: { cls: "badge-neutral", label: "Draft" },
  in_review: { cls: "badge-info", label: "In review" },
  approved: { cls: "badge-ok", label: "Approved" },
};

export const SEVERITY_BADGE: Record<string, { cls: string; label: string }> = {
  error: { cls: "badge-err", label: "Error" },
  warning: { cls: "badge-warn", label: "Warning" },
  info: { cls: "badge-info", label: "Info" },
};
