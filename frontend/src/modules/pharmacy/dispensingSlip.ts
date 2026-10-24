import type { PharmacyQueueItem } from "../../services/interfaces";
import type { Tables } from "../../shared/types/database.types";
import { orderToken } from "./dispensePlan";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Opens a printable dispensing slip for the order's current state. */
export function printDispensingSlip(order: PharmacyQueueItem, batches: Tables<"medicine_stock_batches">[], clinicName: string, doctorName: string) {
  const prescriptionItems = new Map((order.prescription?.prescription_items ?? []).map((item) => [item.id, item]));
  const rows = order.items.map((item) => {
    const rx = item.prescription_item_id ? prescriptionItems.get(item.prescription_item_id) : undefined;
    const batch = batches.find((row) => row.id === item.batch_id);
    return `<tr><td>${escapeHtml(item.medicine_name)}</td><td>${escapeHtml([rx?.dosage, rx?.frequency, rx?.duration].filter(Boolean).join(" · "))}</td><td class="n">${escapeHtml(item.requested_quantity)}</td><td class="n">${escapeHtml(item.dispensed_quantity)}</td><td>${escapeHtml(batch ? `${batch.batch_no}${batch.expiry_date ? ` (exp ${batch.expiry_date})` : ""}` : "")}</td><td>${escapeHtml(item.status)}</td></tr>`;
  }).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Dispensing slip ${escapeHtml(orderToken(order.id))}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#0f172a}h1{font-size:18px;margin:0}p{margin:4px 0;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th,td{border-bottom:1px solid #cbd5e1;padding:6px 4px;text-align:left;vertical-align:top}.n{text-align:right}.allergy{margin-top:10px;padding:8px;border:2px solid #b91c1c;font-weight:600}</style></head>
<body><h1>${escapeHtml(clinicName || "Pharmacy")} · Dispensing slip ${escapeHtml(orderToken(order.id))}</h1>
<p>Patient: <b>${escapeHtml(order.patient?.full_name ?? "Patient")}</b>${order.patient?.phone ? ` · ${escapeHtml(order.patient.phone)}` : ""}</p>
<p>Doctor: ${escapeHtml(doctorName)} · Printed ${escapeHtml(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))}</p>
${order.patient?.allergies ? `<div class="allergy">Allergies: ${escapeHtml(order.patient.allergies)}</div>` : ""}
<table><thead><tr><th>Medicine</th><th>Directions</th><th class="n">Prescribed</th><th class="n">Dispensed</th><th>Batch</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`;
  const slip = window.open("", "_blank", "width=820,height=900");
  if (!slip) return false;
  slip.document.open();
  slip.document.write(html);
  slip.document.close();
  return true;
}
