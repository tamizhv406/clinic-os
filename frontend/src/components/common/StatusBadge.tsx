import type { ReactNode } from "react";
export type StatusTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const tones: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  brand: "border-brand-200 bg-brand-50 text-brand-700",
  success: "border-success-200 bg-success-50 text-success-700",
  warning: "border-warning-200 bg-warning-50 text-warning-700",
  danger: "border-danger-200 bg-danger-50 text-danger-700",
  info: "border-info-200 bg-info-50 text-info-700",
};
export function StatusBadge({ children, tone = "neutral", dot = false, className = "" }: { children: ReactNode; tone?: StatusTone; dot?: boolean; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${tones[tone]} ${className}`}>{dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}{children}</span>;
}
