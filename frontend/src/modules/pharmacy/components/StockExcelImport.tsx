import { useMemo, useRef, useState, type DragEvent } from "react";
import { CheckCircle2, Download, FileSpreadsheet, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, StatusBadge } from "../../../components/ui";
import type { CreatePurchaseEntryInput, StockPurchaseSummary } from "../../../services/interfaces";
import { downloadText, toCsv } from "../../../utils/csv";
import { formatDate } from "../../../utils/formatDate";
import {
  ACCEPTED_IMPORT_EXTENSIONS, MAX_IMPORT_ROWS, buildTemplateWorkbook, checkImportFile, checkPurchaseHeader, checkRows, emptyPurchaseHeader,
  errorReportRows, parseExpiry, parseSheetMatrix, readStockSheet, toPurchaseItems, type ParsedSheet, type PurchaseHeader, type StockField,
  type StockImportRow,
} from "../stockImport";
import type { Supplier } from "../types";
import { rupee } from "../utils";
import { PurchaseHeaderFields } from "./PurchaseHeaderFields";

type ImportResult = { summary: StockPurchaseSummary; skipped: StockImportRow[]; skippedReport: unknown[][] };

const EDITABLE: { field: StockField; label: string; width: string; numeric?: boolean }[] = [
  { field: "medicineName", label: "Medicine", width: "min-w-48" },
  { field: "batchNumber", label: "Batch", width: "min-w-28" },
  { field: "expiryDate", label: "Expiry", width: "min-w-32" },
  { field: "quantity", label: "Qty", width: "min-w-20", numeric: true },
  { field: "purchasePrice", label: "Purchase", width: "min-w-24", numeric: true },
  { field: "sellingPrice", label: "Selling", width: "min-w-24", numeric: true },
  { field: "mrp", label: "MRP", width: "min-w-24", numeric: true },
  { field: "category", label: "Category", width: "min-w-28" },
];

const statusTone = { valid: "success", warning: "warning", error: "danger" } as const;
const statusText = { valid: "Valid", warning: "Warning", error: "Error" } as const;

/** Excel / CSV stock upload: one file = one supplier invoice. Nothing is saved until Import. */
export function StockExcelImport({ knownMedicineNames, suppliers, today, saving, onImport }: {
  knownMedicineNames: Set<string>;
  suppliers: Supplier[];
  today: string;
  saving: boolean;
  /** Resolves with the RPC summary, or null when the database rejected the purchase. */
  onImport: (input: CreatePurchaseEntryInput) => Promise<StockPurchaseSummary | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [header, setHeader] = useState<PurchaseHeader>(() => emptyPurchaseHeader(today));
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [rows, setRows] = useState<StockImportRow[]>([]);
  const [skipErrors, setSkipErrors] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { checks, counts } = useMemo(() => checkRows(rows, { today, knownMedicineNames, mode: "excel" }), [rows, today, knownMedicineNames]);
  const headerErrors = checkPurchaseHeader(header, today);
  const importable = counts.valid + counts.warning;
  const fileErrors = sheet?.fileErrors ?? [];
  const blockedByErrors = counts.error > 0 && !skipErrors;
  const canImport = !saving && !reading && importable > 0 && fileErrors.length === 0 && !blockedByErrors && Object.keys(headerErrors).length === 0;

  const downloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      XLSX.writeFile(buildTemplateWorkbook(XLSX), "vernex_stock_template.xlsx");
    } catch {
      toast.error("Could not create the template. Check your connection and try again.");
    }
  };

  const readFile = async (file: File) => {
    const problem = checkImportFile(file);
    if (problem) { toast.error(problem); return; }
    setReading(true);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const parsed = parseSheetMatrix(readStockSheet(XLSX, await file.arrayBuffer()), () => crypto.randomUUID());
      setFileName(file.name);
      setSheet(parsed);
      setRows(parsed.rows.length > MAX_IMPORT_ROWS ? [] : parsed.rows);
      setSkipErrors(false);
    } catch {
      toast.error("This file could not be read. Save it as .xlsx or .csv and try again.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  };

  const editCell = (id: string, field: StockField, value: string) => setRows((current) => current.map((row) => (row.id === id ? { ...row, values: { ...row.values, [field]: value } } : row)));
  const removeRow = (id: string) => setRows((current) => current.filter((row) => row.id !== id));
  const startOver = () => { setSheet(null); setRows([]); setFileName(""); setResult(null); setSkipErrors(false); };

  const runImport = async () => {
    if (!canImport) return;
    const skipped = rows.filter((row) => checks.get(row.id)?.status === "error");
    const summary = await onImport({
      supplierName: header.supplierName.trim(),
      supplierPhone: header.supplierPhone.trim() || undefined,
      invoiceNumber: header.invoiceNumber.trim(),
      purchaseDate: header.purchaseDate,
      source: "excel",
      items: toPurchaseItems(rows, checks),
    });
    if (!summary) return;
    setResult({ summary, skipped, skippedReport: errorReportRows(rows, checks) });
    setSheet(null);
    setRows([]);
    setHeader(emptyPurchaseHeader(today));
  };

  if (result) {
    const { summary, skipped, skippedReport } = result;
    return <div className="card p-5">
      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-6 text-success-700" /><div>
        <h2 className="font-semibold">Import complete</h2>
        <p className="mt-1 text-sm text-slate-600">{summary.items} row{summary.items === 1 ? "" : "s"} saved from {fileName}. Invoice total {rupee(summary.totalAmount)}.</p>
      </div></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">New batches</dt><dd className="text-lg font-semibold">{summary.batchesCreated}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Batches topped up</dt><dd className="text-lg font-semibold">{summary.batchesToppedUp}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">New medicines</dt><dd className="text-lg font-semibold">{summary.medicinesCreated}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Rows skipped</dt><dd className="text-lg font-semibold">{skipped.length}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {skipped.length > 0 && <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadText(`stock_import_errors_${today}.csv`, toCsv(skippedReport))}>Download error report</Button>}
        <Button icon={<Upload className="size-4" />} onClick={startOver}>Upload another file</Button>
      </div>
    </div>;
  }

  return <div className="space-y-4">
    <div className="card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-semibold">Supplier invoice</h2><p className="mt-1 text-sm text-slate-500">One file is one supplier invoice. Enter its details, then upload the file.</p></div>
        <Button variant="secondary" icon={<FileSpreadsheet className="size-4" />} onClick={downloadTemplate}>Download template</Button>
      </div>
      <div className="mt-4"><PurchaseHeaderFields value={header} onChange={setHeader} suppliers={suppliers} errors={headerErrors} showErrors={rows.length > 0} today={today} /></div>
    </div>

    {!sheet && <div
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`card flex flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center ${dragging ? "border-brand-500 bg-brand-50" : "border-slate-300"}`}
    >
      <Upload className="size-8 text-slate-400" />
      <p className="font-semibold">Drag and drop the stock file here</p>
      <p className="text-sm text-slate-500">{ACCEPTED_IMPORT_EXTENSIONS.join(", ")} · up to 5 MB · up to {MAX_IMPORT_ROWS} rows. Uses the sheet named “Stock”, otherwise the first sheet.</p>
      <input ref={inputRef} type="file" accept={ACCEPTED_IMPORT_EXTENSIONS.join(",")} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} />
      <Button loading={reading} onClick={() => inputRef.current?.click()}>Choose file</Button>
    </div>}

    {sheet && <div className="card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-semibold">Preview: {fileName}</h2><p className="text-sm text-slate-500" aria-live="polite">{counts.valid} valid · {counts.warning} warning{counts.warning === 1 ? "" : "s"} · {counts.error} error{counts.error === 1 ? "" : "s"}. Nothing is saved until you import.</p></div>
        <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={startOver}>Choose another file</Button>
      </div>
      {fileErrors.map((message) => <p key={message} className="mt-3 rounded-lg bg-danger-50 p-3 text-sm font-medium text-danger-700">{message}</p>)}
      {sheet.unknownColumns.length > 0 && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Ignored columns: {sheet.unknownColumns.join(", ")}</p>}

      {rows.length > 0 && <div className="mt-4 max-h-[60vh] overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-2 py-2">Status</th><th className="px-2 py-2">Row</th>{EDITABLE.map((column) => <th key={column.field} className="px-2 py-2">{column.label}</th>)}<th className="px-2 py-2">Notes</th><th className="px-2 py-2"><span className="sr-only">Remove</span></th></tr></thead>
          <tbody>{rows.map((row) => {
            const check = checks.get(row.id);
            const expiry = parseExpiry(row.values.expiryDate);
            return <tr key={row.id} className={`border-t align-top ${check?.status === "error" ? "bg-danger-50/40" : ""}`}>
              <td className="px-2 py-2">{check && <StatusBadge tone={statusTone[check.status]}>{statusText[check.status]}</StatusBadge>}</td>
              <td className="px-2 py-2 tabular-nums text-slate-500">{row.rowNumber}</td>
              {EDITABLE.map((column) => <td key={column.field} className={`px-1 py-1 ${column.width}`}>
                <Input aria-label={`${column.label}, row ${row.rowNumber}`} inputMode={column.numeric ? "decimal" : undefined} className="min-h-9 px-2" value={row.values[column.field]} onChange={(event) => editCell(row.id, column.field, event.target.value)} />
                {column.field === "expiryDate" && expiry.iso && <p className="mt-0.5 px-1 text-[11px] text-slate-500">{formatDate(expiry.iso)}</p>}
              </td>)}
              <td className="min-w-56 px-2 py-2 text-xs">
                {check?.errors.map((message) => <p key={message} className="text-danger-700">{message}</p>)}
                {check?.warnings.map((message) => <p key={message} className="text-warning-700">{message}</p>)}
              </td>
              <td className="px-1 py-1"><Button variant="ghost" size="sm" aria-label={`Remove row ${row.rowNumber}`} onClick={() => removeRow(row.id)}><Trash2 className="size-4" /></Button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className={`flex items-center gap-2 text-sm ${counts.error ? "" : "text-slate-400"}`}><input type="checkbox" className="size-4" checked={skipErrors} disabled={!counts.error} onChange={(event) => setSkipErrors(event.target.checked)} />Skip rows with errors ({counts.error})</label>
        <div className="flex flex-wrap items-center gap-2">
          {!canImport && !saving && <span className="text-xs text-slate-500">{fileErrors.length ? "Fix the file first." : importable === 0 ? "No rows can be imported." : blockedByErrors ? "Fix or skip the rows with errors." : Object.keys(headerErrors).length ? "Complete the supplier invoice details." : ""}</span>}
          <Button loading={saving} disabled={!canImport} onClick={runImport}>Import {importable} row{importable === 1 ? "" : "s"}</Button>
        </div>
      </div>
    </div>}
  </div>;
}
