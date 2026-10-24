import type { ReactNode } from "react";

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="card p-3"><div className="grid gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">{children}</div></div>;
}
