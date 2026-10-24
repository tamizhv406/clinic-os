import { Input } from "./Input";
function dateOffset(days: number) { const date = new Date(); date.setDate(date.getDate() + days); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export function DateRangePicker({ from = dateOffset(-6), to = dateOffset(0) }: { from?: string; to?: string }) {
  return <div className="grid gap-2 sm:grid-cols-2"><Input type="date" defaultValue={from} aria-label="From date" /><Input type="date" defaultValue={to} aria-label="To date" /></div>;
}

