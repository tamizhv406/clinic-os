import { Button } from "./Button";

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  return <nav className="flex items-center justify-between gap-4 rounded-card border bg-white px-3 py-2" aria-label="Pagination"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button><span className="text-sm font-semibold text-slate-600">Page {page} of {totalPages}</span><Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button></nav>;
}
