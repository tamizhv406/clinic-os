import type { ReactNode } from "react";
import { useEffect } from "react";
export function PageHeader({ title, description, action, eyebrow, breadcrumb }: { title: string; description?: string; action?: ReactNode; eyebrow?: ReactNode; breadcrumb?: ReactNode }) {
  useEffect(() => { document.title = `${title} · Vernex Clinic OS`; }, [title]);
  return <header className="mb-6 flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0">{breadcrumb && <div className="mb-2 text-xs text-slate-500">{breadcrumb}</div>}{eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{eyebrow}</p>}<h1 className="text-[22px] font-semibold leading-7 text-slate-900 md:text-2xl">{title}</h1>{description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}</div>{action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}</header>;
}
