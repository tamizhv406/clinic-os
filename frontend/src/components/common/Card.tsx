import type { ReactNode } from "react";
type CardPadding = "none" | "sm" | "md" | "lg";
export function Card({ children, className = "", title, description, actions, padding = "md" }: { children: ReactNode; className?: string; title?: ReactNode; description?: ReactNode; actions?: ReactNode; padding?: CardPadding }) {
  const paddings: Record<CardPadding, string> = { none: "", sm: "p-4", md: "p-4 md:p-5", lg: "p-5 md:p-6" };
  return <section className={`card ${paddings[padding]} ${className}`}>{(title || description || actions) && <header className="mb-4 flex flex-wrap items-start justify-between gap-4"><div>{title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{actions}</header>}{children}</section>;
}
