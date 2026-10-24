import { toast } from "sonner";
import { Button } from "../../../components/ui";

export type ExportRow = Record<string, string | number>;

function toCsv(rows: ExportRow[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportActions({ rows = [], filename = "vernex-report" }: { rows?: ExportRow[]; filename?: string }) {
  const exportCsv = () => {
    if (rows.length === 0) {
      toast.error("There is nothing to export for the current filters.");
      return;
    }
    download(`${filename}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv;charset=utf-8");
    toast.success("Report exported as CSV.");
  };

  return <div className="flex flex-wrap gap-2">
    <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
    <Button variant="secondary" onClick={() => window.print()}>Print / Save as PDF</Button>
  </div>;
}
