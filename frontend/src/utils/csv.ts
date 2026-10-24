// CSV export helpers shared by the pharmacy pages.

// A cell starting with one of these is treated as a formula by Excel/Sheets
// ("CSV injection"); prefixing an apostrophe makes it plain text.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_PREFIX.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Saves text as a file in the browser. A BOM is added so Excel opens UTF-8 (₹, names) correctly. */
const BYTE_ORDER_MARK = "\uFEFF";

export function downloadText(filename: string, text: string, mimeType = "text/csv;charset=utf-8") {
  const blob = new Blob([mimeType.startsWith("text/csv") ? `${BYTE_ORDER_MARK}${text}` : text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
