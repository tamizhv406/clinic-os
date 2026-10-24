// Pure parsing and validation for stock intake (manual grid and Excel/CSV upload).
// No React, no Supabase, no SheetJS: the Add Stock page reads the file and passes
// plain cell values in, so these rules can be tested on their own.
//
// The row rules mirror public.create_stock_purchase (supabase migration
// 20261013121000) so a row that passes here is accepted by the database.

import type { CreatePurchaseEntryInput } from "../../services/interfaces";
import { daysBetweenISO } from "../../utils/formatDate";

export const MEDICINE_CATEGORIES = ["general", "antibiotic", "dental", "skin", "pediatric", "physiotherapy", "supplement"] as const;
export type MedicineCategoryValue = (typeof MEDICINE_CATEGORIES)[number];

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv"];
export const EXPIRY_WARNING_DAYS = 90;
const MAX_QUANTITY = 1_000_000;

export type StockField =
  | "medicineName" | "batchNumber" | "expiryDate" | "quantity" | "purchasePrice" | "sellingPrice" | "mrp"
  | "genericName" | "category" | "manufacturer" | "strength" | "unit" | "hsnCode" | "gstRate" | "reorderLevel";

export type StockColumn = { field: StockField; header: string; required: boolean; aliases: string[]; rule: string };

/** Column order of the downloadable template. Aliases are compared after normalizeHeader(). */
export const STOCK_COLUMNS: StockColumn[] = [
  { field: "medicineName", header: "Medicine Name", required: true, aliases: ["medicine", "item", "item name", "product", "drug"], rule: "Text. Matched to an existing medicine by name (not case-sensitive); otherwise a new medicine is created." },
  { field: "batchNumber", header: "Batch No", required: true, aliases: ["batch", "batch number", "batch no.", "lot"], rule: "Text. Receiving an existing batch again adds to its quantity." },
  { field: "expiryDate", header: "Expiry Date", required: true, aliases: ["expiry", "exp", "exp date", "expiry dt"], rule: "DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, MM/YY or MMM-YY (or an Excel date). Month-only dates mean the last day of that month. Must be in the future." },
  { field: "quantity", header: "Quantity", required: true, aliases: ["qty", "units", "quantity received"], rule: "Whole number greater than 0." },
  { field: "purchasePrice", header: "Purchase Price", required: true, aliases: ["rate", "cost", "purchase rate", "ptr"], rule: "Number, 0 or more (per unit)." },
  { field: "sellingPrice", header: "Selling Price", required: true, aliases: ["sale price", "selling rate", "price"], rule: "Number, 0 or more (per unit). Must not exceed MRP." },
  { field: "mrp", header: "MRP", required: false, aliases: ["m.r.p"], rule: "Optional number, 0 or more." },
  { field: "genericName", header: "Generic Name", required: false, aliases: ["generic"], rule: "Optional. Used only for new medicines or empty fields." },
  { field: "category", header: "Category", required: false, aliases: [], rule: `Optional. One of: ${MEDICINE_CATEGORIES.join(", ")}. Anything else becomes "general" (with a warning).` },
  { field: "manufacturer", header: "Manufacturer", required: false, aliases: ["company", "mfr"], rule: "Optional." },
  { field: "strength", header: "Strength", required: false, aliases: [], rule: "Optional, e.g. 650mg." },
  { field: "unit", header: "Unit", required: false, aliases: ["form"], rule: "Optional, e.g. tablet, capsule, bottle." },
  { field: "hsnCode", header: "HSN Code", required: false, aliases: ["hsn"], rule: "Optional." },
  { field: "gstRate", header: "GST %", required: false, aliases: ["gst", "tax %", "gst rate"], rule: "Optional number from 0 to 28." },
  { field: "reorderLevel", header: "Reorder Level", required: false, aliases: ["min stock"], rule: "Optional whole number, 0 or more." },
];

export const TEMPLATE_EXAMPLE_ROWS: string[][] = [
  ["Paracetamol 650mg", "PCM-A30", "31-08-2027", "200", "1.80", "2.50", "2.80", "Paracetamol", "general", "Cipla", "650mg", "tablet", "3004", "12", "40"],
  ["Amoxicillin 500mg", "AMX-B12", "06/27", "100", "6.40", "9.00", "10.00", "Amoxicillin", "antibiotic", "Sun Pharma", "500mg", "capsule", "3004", "12", "30"],
  ["Calamine Lotion 100ml", "CAL-K01", "Mar-28", "24", "52.00", "78.00", "85.00", "Calamine", "skin", "Lacto Calamine", "100ml", "bottle", "3304", "18", "6"],
];

export function normalizeHeader(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9%]/g, "");
}

const HEADER_LOOKUP = new Map<string, StockField>();
for (const column of STOCK_COLUMNS) {
  for (const name of [column.header, ...column.aliases]) HEADER_LOOKUP.set(normalizeHeader(name), column.field);
}

export type HeaderMapping = {
  columns: Partial<Record<StockField, number>>;
  unknownColumns: string[];
  missingRequired: StockColumn[];
};

export function mapHeaders(headerRow: unknown[]): HeaderMapping {
  const columns: Partial<Record<StockField, number>> = {};
  const unknownColumns: string[] = [];
  headerRow.forEach((cell, index) => {
    const label = String(cell ?? "").trim();
    if (!label) return;
    const field = HEADER_LOOKUP.get(normalizeHeader(label));
    if (field && columns[field] === undefined) columns[field] = index;
    else unknownColumns.push(label);
  });
  return { columns, unknownColumns, missingRequired: STOCK_COLUMNS.filter((column) => column.required && columns[column.field] === undefined) };
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const fullYear = (year: number) => (year < 100 ? 2000 + year : year);

function isoIfValid(year: number, month: number, day: number) {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > lastDayOfMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Excel stores dates as days since 1899-12-30 (this offset absorbs Excel's 1900 leap-year bug). */
export function excelSerialToISO(serial: number) {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10);
}

export type ParsedExpiry = { iso: string | null; monthOnly: boolean };

/** Accepts the formats listed in the template; month-only values become the last day of the month. */
export function parseExpiry(value: unknown): ParsedExpiry {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { iso: isoIfValid(value.getFullYear(), value.getMonth() + 1, value.getDate()), monthOnly: false };
  }
  if (typeof value === "number") return { iso: excelSerialToISO(value), monthOnly: false };
  const text = String(value ?? "").trim();
  if (!text) return { iso: null, monthOnly: false };
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return { iso: isoIfValid(+match[1], +match[2], +match[3]), monthOnly: false };
  if ((match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/))) return { iso: isoIfValid(fullYear(+match[3]), +match[2], +match[1]), monthOnly: false };
  if ((match = text.match(/^(\d{4})-(\d{1,2})$/))) {
    const [year, month] = [+match[1], +match[2]];
    return { iso: month >= 1 && month <= 12 ? isoIfValid(year, month, lastDayOfMonth(year, month)) : null, monthOnly: true };
  }
  if ((match = text.match(/^(\d{1,2})[-/.](\d{4}|\d{2})$/))) {
    const [month, year] = [+match[1], fullYear(+match[2])];
    return { iso: month >= 1 && month <= 12 ? isoIfValid(year, month, lastDayOfMonth(year, month)) : null, monthOnly: true };
  }
  if ((match = text.match(/^([a-z]{3})[a-z]*[-/. ]+(\d{4}|\d{2})$/i))) {
    const month = MONTHS.indexOf(match[1].toLowerCase()) + 1;
    const year = fullYear(+match[2]);
    return { iso: month ? isoIfValid(year, month, lastDayOfMonth(year, month)) : null, monthOnly: true };
  }
  if ((match = text.match(/^(\d{1,2})[-/. ]+([a-z]{3})[a-z]*[-/. ]+(\d{4}|\d{2})$/i))) {
    const month = MONTHS.indexOf(match[2].toLowerCase()) + 1;
    return { iso: month ? isoIfValid(fullYear(+match[3]), month, +match[1]) : null, monthOnly: false };
  }
  // A bare number is an Excel serial that arrived as text (e.g. via CSV).
  if (/^\d{4,7}(\.\d+)?$/.test(text)) return { iso: excelSerialToISO(Number(text)), monthOnly: false };
  return { iso: null, monthOnly: false };
}

/** null when empty, NaN when present but not a number. Accepts "1,200", "₹ 2.50", "Rs. 3". */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const text = String(value).trim().replace(/^(₹|rs\.?|inr)\s*/i, "").replace(/,/g, "");
  if (!text) return null;
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

/** Cell value as the text the user sees and edits; Excel date serials in the expiry column become YYYY-MM-DD. */
export function cellToText(value: unknown, field?: StockField) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return parseExpiry(value).iso ?? "";
  if (typeof value === "number") {
    if (field === "expiryDate") return excelSerialToISO(value) ?? String(value);
    return String(value);
  }
  return String(value).trim();
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type StockRowValues = Record<StockField, string>;

export const emptyRowValues = (): StockRowValues => ({
  medicineName: "", batchNumber: "", expiryDate: "", quantity: "", purchasePrice: "", sellingPrice: "", mrp: "",
  genericName: "", category: "", manufacturer: "", strength: "", unit: "", hsnCode: "", gstRate: "", reorderLevel: "",
});

export type StockImportRow = { id: string; rowNumber: number; values: StockRowValues };

export type RowCheck = {
  status: "valid" | "warning" | "error";
  errors: string[];
  warnings: string[];
  expiryISO: string | null;
  isNewMedicine: boolean;
};

export type ValidationContext = {
  /** Clinic "today" (YYYY-MM-DD), from localDateISO(). */
  today: string;
  /** Lower-cased, trimmed names of the clinic's active medicines. */
  knownMedicineNames: Set<string>;
  /** "excel" defaults an unknown category to general with a warning; "manual" treats it as an error. */
  mode: "excel" | "manual";
};

export const medicineKey = (name: string) => name.trim().toLowerCase();
export const batchKey = (name: string, batch: string) => `${medicineKey(name)}\u001f${batch.trim().toLowerCase()}`;

export const isBlankRow = (values: StockRowValues) => Object.values(values).every((value) => !value.trim());

export function checkRow(values: StockRowValues, context: ValidationContext): RowCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = values.medicineName.trim();
  const batch = values.batchNumber.trim();

  if (!name) errors.push("Medicine name is required");
  else if (name.length > 200) errors.push("Medicine name is too long (max 200 characters)");

  if (!batch) errors.push("Batch number is required");
  else if (batch.length > 100) errors.push("Batch number is too long (max 100 characters)");

  const expiry = parseExpiry(values.expiryDate);
  if (!values.expiryDate.trim()) errors.push("Expiry date is required");
  else if (!expiry.iso) errors.push(`Expiry date "${values.expiryDate.trim()}" is not a recognised date`);
  else {
    const daysLeft = daysBetweenISO(context.today, expiry.iso);
    if (daysLeft <= 0) errors.push(`Expiry date ${expiry.iso} is not in the future`);
    else if (daysLeft <= EXPIRY_WARNING_DAYS) warnings.push(`Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`);
    if (expiry.monthOnly) warnings.push(`Month-only expiry read as ${expiry.iso}`);
  }

  const quantity = parseNumber(values.quantity);
  if (quantity === null) errors.push("Quantity is required");
  else if (Number.isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) errors.push(`Quantity "${values.quantity.trim()}" must be a whole number greater than 0`);
  else if (quantity > MAX_QUANTITY) errors.push("Quantity is too large (max 1,000,000)");

  const purchase = parseNumber(values.purchasePrice);
  if (purchase === null) errors.push("Purchase price is required");
  else if (Number.isNaN(purchase)) errors.push(`Purchase price "${values.purchasePrice.trim()}" is not a number`);
  else if (purchase < 0) errors.push("Purchase price cannot be negative");

  const selling = parseNumber(values.sellingPrice);
  if (selling === null) errors.push("Selling price is required");
  else if (Number.isNaN(selling)) errors.push(`Selling price "${values.sellingPrice.trim()}" is not a number`);
  else if (selling < 0) errors.push("Selling price cannot be negative");

  const mrp = parseNumber(values.mrp);
  if (mrp !== null) {
    if (Number.isNaN(mrp)) errors.push(`MRP "${values.mrp.trim()}" is not a number`);
    else if (mrp < 0) errors.push("MRP cannot be negative");
    else if (mrp > 0 && selling !== null && !Number.isNaN(selling) && selling > mrp) errors.push("Selling price cannot be more than MRP");
  }

  const gst = parseNumber(values.gstRate);
  if (gst !== null && (Number.isNaN(gst) || gst < 0 || gst > 28)) errors.push("GST % must be a number between 0 and 28");

  const reorder = parseNumber(values.reorderLevel);
  if (reorder !== null && (Number.isNaN(reorder) || reorder < 0 || !Number.isInteger(reorder))) errors.push("Reorder level must be a whole number of 0 or more");

  const category = values.category.trim().toLowerCase();
  if (category && !(MEDICINE_CATEGORIES as readonly string[]).includes(category)) {
    if (context.mode === "excel") warnings.push(`Category "${values.category.trim()}" is not recognised; "general" will be used`);
    else errors.push(`Category must be one of: ${MEDICINE_CATEGORIES.join(", ")}`);
  }

  const isNewMedicine = Boolean(name) && !context.knownMedicineNames.has(medicineKey(name));
  if (isNewMedicine) warnings.push("New medicine will be created");

  return { status: errors.length ? "error" : warnings.length ? "warning" : "valid", errors, warnings, expiryISO: expiry.iso, isNewMedicine };
}

/** Validates every row and flags repeated medicine+batch pairs (the database rejects those). */
export function checkRows(rows: StockImportRow[], context: ValidationContext) {
  const firstSeen = new Map<string, number>();
  const checks = new Map<string, RowCheck>();
  for (const row of rows) {
    const check = checkRow(row.values, context);
    const name = row.values.medicineName.trim();
    const batch = row.values.batchNumber.trim();
    if (name && batch) {
      const key = batchKey(name, batch);
      const earlier = firstSeen.get(key);
      if (earlier !== undefined) {
        check.errors.push(`Same medicine and batch as row ${earlier}`);
        check.status = "error";
      } else {
        firstSeen.set(key, row.rowNumber);
      }
    }
    checks.set(row.id, check);
  }
  const counts = { valid: 0, warning: 0, error: 0 };
  for (const check of checks.values()) counts[check.status] += 1;
  return { checks, counts };
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export type ParsedSheet = {
  rows: StockImportRow[];
  unknownColumns: string[];
  missingRequired: StockColumn[];
  fileErrors: string[];
};

/** Turns a sheet (array of rows of cell values, header first) into editable rows. */
export function parseSheetMatrix(matrix: unknown[][], makeId: () => string): ParsedSheet {
  const isEmpty = (row: unknown[]) => row.every((cell) => String(cell ?? "").trim() === "");
  const headerIndex = matrix.findIndex((row) => !isEmpty(row));
  if (headerIndex === -1) return { rows: [], unknownColumns: [], missingRequired: [], fileErrors: ["The file is empty."] };

  const mapping = mapHeaders(matrix[headerIndex]);
  const fileErrors: string[] = [];
  if (mapping.missingRequired.length) {
    fileErrors.push(`Missing required column${mapping.missingRequired.length > 1 ? "s" : ""}: ${mapping.missingRequired.map((column) => column.header).join(", ")}. Download the template to see the expected headers.`);
  }

  const rows: StockImportRow[] = [];
  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const source = matrix[index] ?? [];
    if (isEmpty(source)) continue;
    const values = emptyRowValues();
    for (const column of STOCK_COLUMNS) {
      const at = mapping.columns[column.field];
      if (at !== undefined) values[column.field] = cellToText(source[at], column.field);
    }
    // Spreadsheet row numbers are 1-based and include the header row.
    rows.push({ id: makeId(), rowNumber: index + 1, values });
  }
  if (rows.length === 0 && !fileErrors.length) fileErrors.push("The file has a header row but no data rows.");
  if (rows.length > MAX_IMPORT_ROWS) fileErrors.push(`The file has ${rows.length} data rows; the limit is ${MAX_IMPORT_ROWS}. Split it into smaller files.`);
  return { rows, unknownColumns: mapping.unknownColumns, missingRequired: mapping.missingRequired, fileErrors };
}

export function checkImportFile(file: { name: string; size: number }) {
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_IMPORT_EXTENSIONS.some((extension) => lower.endsWith(extension))) return `Only ${ACCEPTED_IMPORT_EXTENSIONS.join(", ")} files are accepted.`;
  if (file.size > MAX_IMPORT_FILE_BYTES) return "The file is larger than 5 MB.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

// ---------------------------------------------------------------------------
// Purchase header (one supplier invoice)
// ---------------------------------------------------------------------------

export type PurchaseHeader = { supplierName: string; supplierPhone: string; invoiceNumber: string; purchaseDate: string; notes: string };
export type PurchaseHeaderErrors = Partial<Record<keyof PurchaseHeader, string>>;

export const emptyPurchaseHeader = (today: string): PurchaseHeader => ({ supplierName: "", supplierPhone: "", invoiceNumber: "", purchaseDate: today, notes: "" });

/** Same header rules as create_stock_purchase. */
export function checkPurchaseHeader(header: PurchaseHeader, today: string): PurchaseHeaderErrors {
  const errors: PurchaseHeaderErrors = {};
  const supplier = header.supplierName.trim();
  if (!supplier) errors.supplierName = "Supplier name is required";
  else if (supplier.length > 200) errors.supplierName = "Supplier name is too long (max 200 characters)";
  if (header.supplierPhone.trim().length > 30) errors.supplierPhone = "Supplier phone is too long (max 30 characters)";
  const invoice = header.invoiceNumber.trim();
  if (!invoice) errors.invoiceNumber = "Invoice number is required";
  else if (invoice.length > 100) errors.invoiceNumber = "Invoice number is too long (max 100 characters)";
  if (!header.purchaseDate) errors.purchaseDate = "Purchase date is required";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(header.purchaseDate) || !parseExpiry(header.purchaseDate).iso) errors.purchaseDate = "Purchase date is not a valid date";
  else if (header.purchaseDate > today) errors.purchaseDate = "Purchase date cannot be in the future";
  if (header.notes.trim().length > 2000) errors.notes = "Notes are too long (max 2000 characters)";
  return errors;
}

// SheetJS is passed in by the caller (loaded with a dynamic import on the Excel
// tab only), so this module never pulls it into the main bundle.
type SheetJS = typeof import("xlsx");

/** Reads the sheet named "Stock" if there is one, otherwise the first sheet, as rows of raw cell values. */
export function readStockSheet(XLSX: SheetJS, data: ArrayBuffer): unknown[][] {
  // raw: true keeps CSV text exactly as typed (no guessing of US-style dates);
  // .xlsx dates arrive as Excel serial numbers, which parseExpiry understands.
  const workbook = XLSX.read(data, { type: "array", raw: true });
  const sheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === "stock") ?? workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "", blankrows: false });
}

/** The downloadable template: a "Stock" sheet (headers + 3 examples) and an "Instructions" sheet. */
export function buildTemplateWorkbook(XLSX: SheetJS) {
  const workbook = XLSX.utils.book_new();
  const stock = XLSX.utils.aoa_to_sheet([STOCK_COLUMNS.map((column) => column.header), ...TEMPLATE_EXAMPLE_ROWS]);
  stock["!cols"] = STOCK_COLUMNS.map((column) => ({ wch: Math.max(12, column.header.length + 2) }));
  // Keep every cell as text so Excel does not re-interpret dates or batch numbers.
  for (const address of Object.keys(stock)) {
    if (!address.startsWith("!")) stock[address].t = "s";
  }
  XLSX.utils.book_append_sheet(workbook, stock, "Stock");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["Vernex Clinic OS - stock upload template"],
    [],
    ["How it works"],
    ["One file = one supplier invoice. Enter the supplier name, invoice number and purchase date on the Add Stock page, then upload this file."],
    ["Fill one row per medicine batch on the Stock sheet. Delete the three example rows first."],
    [`Up to ${MAX_IMPORT_ROWS} rows and 5 MB per file. Accepted files: .xlsx, .xls, .csv.`],
    ["Nothing is saved until you review the preview and press Import. Either every row is saved, or none is."],
    ["Receiving an existing batch again adds to its quantity; it never replaces it."],
    [],
    ["Column", "Required", "Other accepted header names", "Rule"],
    ...STOCK_COLUMNS.map((column) => [column.header, column.required ? "Yes" : "No", column.aliases.join(", "), column.rule]),
    [],
    ["Accepted expiry date formats"],
    ["31-08-2027, 31/08/2027, 2027-08-31, 08/27, Aug-27 (month-only dates mean the last day of the month), or an Excel date cell."],
  ]);
  instructions["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 38 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  return workbook;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const optionalNumber = (value: string) => { const n = parseNumber(value); return n === null || Number.isNaN(n) ? undefined : n; };
const optionalText = (value: string) => value.trim() || undefined;

/** Builds the create_stock_purchase items for rows that passed validation. */
export function toPurchaseItems(rows: StockImportRow[], checks: Map<string, RowCheck>): CreatePurchaseEntryInput["items"] {
  return rows
    .filter((row) => checks.get(row.id)?.status !== "error")
    .map((row) => {
      const v = row.values;
      const category = v.category.trim().toLowerCase();
      return {
        medicineName: v.medicineName.trim(),
        batchNumber: v.batchNumber.trim(),
        expiryDate: checks.get(row.id)?.expiryISO ?? "",
        quantity: parseNumber(v.quantity) ?? 0,
        purchasePrice: parseNumber(v.purchasePrice) ?? 0,
        sellingPrice: parseNumber(v.sellingPrice) ?? 0,
        mrp: optionalNumber(v.mrp),
        category: category ? ((MEDICINE_CATEGORIES as readonly string[]).includes(category) ? category : "general") : undefined,
        genericName: optionalText(v.genericName),
        manufacturer: optionalText(v.manufacturer),
        strength: optionalText(v.strength),
        unit: optionalText(v.unit),
        hsnCode: optionalText(v.hsnCode),
        gstRate: optionalNumber(v.gstRate),
        reorderLevel: optionalNumber(v.reorderLevel),
      };
    });
}

/** Rows for the "Download error report" CSV: the original values plus the reasons. */
export function errorReportRows(rows: StockImportRow[], checks: Map<string, RowCheck>) {
  const header = ["Spreadsheet row", ...STOCK_COLUMNS.map((column) => column.header), "Problems"];
  const body = rows
    .filter((row) => checks.get(row.id)?.status === "error")
    .map((row) => [row.rowNumber, ...STOCK_COLUMNS.map((column) => row.values[column.field]), (checks.get(row.id)?.errors ?? []).join("; ")]);
  return [header, ...body];
}

/** Line totals for the live footer (rows that have a usable quantity and price). */
export function purchaseTotals(rows: StockRowValues[], gstFor: (values: StockRowValues) => number) {
  let units = 0;
  let amount = 0;
  let gst = 0;
  for (const values of rows) {
    const quantity = parseNumber(values.quantity);
    const price = parseNumber(values.purchasePrice);
    if (quantity === null || Number.isNaN(quantity) || quantity <= 0) continue;
    units += quantity;
    if (price === null || Number.isNaN(price) || price < 0) continue;
    amount += quantity * price;
    gst += (quantity * price * gstFor(values)) / 100;
  }
  return { units, amount: Math.round(amount * 100) / 100, gst: Math.round(gst * 100) / 100 };
}
