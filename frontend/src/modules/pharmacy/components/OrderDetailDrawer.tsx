import { useState } from "react";
import { AlertTriangle, Printer } from "lucide-react";
import { Button, Drawer, Input, Select, StatusBadge } from "../../../components/ui";
import { doctorLabel } from "../../../hooks/usePharmacyQueueLive";
import type { PharmacyQueueItem } from "../../../services/interfaces";
import type { Tables } from "../../../shared/types/database.types";
import { formatDate } from "../../../utils/formatDate";
import { initialLines, isSettled, lineError, orderToken, patientAge, remainingQuantity, timeSince, totalUsable, usableBatches, type DispenseLine } from "../dispensePlan";

type BatchRow = Tables<"medicine_stock_batches">;
export type DispenseRequest = Array<{ orderItemId: string; batchId: string; quantity: number }>;

const itemTone = { pending: "warning", partial: "info", dispensed: "success", unavailable: "danger", cancelled: "neutral" } as const;

/** One pharmacy order: allergies, FEFO batches, dispense / bill / print. */
export function OrderDetailDrawer({ order, batches, today, canDispense, busy, onClose, onDispense, onDispenseAndBill, onMarkUnavailable, onPrint }: {
  order: PharmacyQueueItem | null;
  batches: BatchRow[];
  today: string;
  canDispense: boolean;
  busy: boolean;
  onClose: () => void;
  onDispense: (items: DispenseRequest) => Promise<boolean>;
  onDispenseAndBill: (items: DispenseRequest) => Promise<boolean>;
  onMarkUnavailable: (orderItemId: string, reason: string) => Promise<boolean>;
  onPrint: () => void;
}) {
  // The parent remounts this drawer (key={drawerKey(order)}) whenever the order
  // changes, so the FEFO defaults are computed once from fresh data.
  const [lines, setLines] = useState<Record<string, DispenseLine>>(() => (order ? initialLines(order, batches, today) : {}));
  const [unavailableFor, setUnavailableFor] = useState<{ itemId: string; reason: string } | null>(null);

  if (!order) return null;
  const prescriptionItems = new Map((order.prescription?.prescription_items ?? []).map((item) => [item.id, item]));
  const age = patientAge(order.patient, today);
  const selected = order.items.filter((item) => lines[item.id]?.selected);
  const errors = Object.fromEntries(order.items.map((item) => [item.id, lines[item.id] ? lineError(item, lines[item.id], batches, today) : ""]));
  const canSubmit = canDispense && !busy && selected.length > 0 && selected.every((item) => !errors[item.id]);
  const request = (): DispenseRequest => selected.map((item) => ({ orderItemId: item.id, batchId: lines[item.id].batchId, quantity: Number(lines[item.id].quantity) }));
  const setLine = (id: string, patch: Partial<DispenseLine>) => setLines((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const closed = order.status === "dispensed" || order.status === "cancelled";

  return <Drawer open onClose={onClose} width="sm:max-w-2xl" title={`${order.patient?.full_name ?? "Patient"} · ${orderToken(order.id)}`}
    description={<>{[age !== null ? `${age} y` : null, order.patient?.gender, order.patient?.phone].filter(Boolean).join(" · ")}<br />{doctorLabel(order)} · {order.prescription?.diagnosis_summary || "No diagnosis recorded"} · routed {timeSince(order.created_at)}</>}
    footer={canDispense && !closed ? <>
      <Button variant="secondary" icon={<Printer className="size-4" />} onClick={onPrint}>Print slip</Button>
      <Button variant="secondary" loading={busy} disabled={!canSubmit} onClick={() => void onDispense(request())}>Dispense selected</Button>
      <Button loading={busy} disabled={!canSubmit} onClick={() => void onDispenseAndBill(request())}>Dispense and create bill</Button>
    </> : <Button variant="secondary" icon={<Printer className="size-4" />} onClick={onPrint}>Print slip</Button>}>
    <div className="space-y-4">
      {order.patient?.allergies?.trim()
        ? <div className="flex gap-3 rounded-xl border-2 border-danger-700 bg-danger-50 p-3 text-danger-700" role="alert"><AlertTriangle className="size-5 shrink-0" /><div><p className="text-sm font-bold uppercase tracking-wide">Allergies</p><p className="text-sm font-semibold">{order.patient.allergies}</p></div></div>
        : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No allergies recorded for this patient. Confirm with the patient before dispensing.</p>}

      {order.items.map((item) => {
        const rx = item.prescription_item_id ? prescriptionItems.get(item.prescription_item_id) : undefined;
        const stock = totalUsable(item.medicine_id, batches, today);
        const options = usableBatches(item.medicine_id, batches, today);
        const line = lines[item.id];
        const settled = isSettled(item);
        const remaining = remainingQuantity(item);
        return <div key={item.id} className={`rounded-xl border p-3 ${!settled && stock === 0 ? "border-danger-200 bg-danger-50/50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <label className="flex min-w-0 items-start gap-2">
              {canDispense && !settled && <input type="checkbox" className="mt-1 size-4" checked={Boolean(line?.selected)} disabled={options.length === 0} onChange={(event) => setLine(item.id, { selected: event.target.checked })} aria-label={`Dispense ${item.medicine_name}`} />}
              <span className="min-w-0"><span className="block font-semibold">{item.medicine_name}</span>
                <span className="block text-xs text-slate-500">{[rx?.dosage, rx?.frequency, rx?.timing, rx?.duration].filter(Boolean).join(" · ") || "No directions recorded"}</span>
                {rx?.instructions && <span className="block text-xs text-slate-500">{rx.instructions}</span>}
                {item.notes && <span className={`block text-xs ${item.status === "unavailable" ? "text-danger-700" : "text-slate-500"}`}>{item.notes}</span>}
              </span>
            </label>
            <StatusBadge tone={itemTone[(item.status ?? "pending") as keyof typeof itemTone] ?? "neutral"}>{item.status ?? "pending"}</StatusBadge>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-slate-500">Prescribed</dt><dd className="font-semibold">{item.requested_quantity ?? 0}</dd></div>
            <div><dt className="text-slate-500">Dispensed</dt><dd className="font-semibold">{item.dispensed_quantity ?? 0}</dd></div>
            <div><dt className="text-slate-500">In stock</dt><dd className={`font-semibold ${stock === 0 ? "text-danger-700" : ""}`}>{item.medicine_id ? stock : "Not in catalogue"}</dd></div>
          </dl>
          {canDispense && !settled && line?.selected && <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr]">
            <Select aria-label={`Batch for ${item.medicine_name}`} value={line.batchId} onChange={(event) => setLine(item.id, { batchId: event.target.value })}>
              {options.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_no} · {batch.quantity_available} left{batch.expiry_date ? ` · exp ${formatDate(batch.expiry_date)}` : ""}</option>)}
            </Select>
            <Input aria-label={`Quantity of ${item.medicine_name}`} inputMode="numeric" value={line.quantity} onChange={(event) => setLine(item.id, { quantity: event.target.value })} placeholder={`Up to ${remaining}`} />
            {errors[item.id] && <p className="text-xs text-danger-700 sm:col-span-2">{errors[item.id]}</p>}
          </div>}
          {canDispense && !settled && item.status !== "unavailable" && (unavailableFor?.itemId === item.id
            ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input aria-label="Reason" value={unavailableFor.reason} onChange={(event) => setUnavailableFor({ itemId: item.id, reason: event.target.value })} placeholder="Reason (optional)" maxLength={500} /><div className="flex gap-2"><Button size="sm" variant="danger" loading={busy} onClick={async () => { if (await onMarkUnavailable(item.id, unavailableFor.reason.trim())) setUnavailableFor(null); }}>Confirm</Button><Button size="sm" variant="ghost" onClick={() => setUnavailableFor(null)}>Cancel</Button></div></div>
            : <Button size="sm" variant="ghost" className="mt-2" onClick={() => setUnavailableFor({ itemId: item.id, reason: "" })}>Mark unavailable</Button>)}
        </div>;
      })}
      {closed && <p className="text-sm text-slate-500">This order is {order.status}.</p>}
      {!canDispense && <p className="text-sm text-slate-500">View only. Dispensing needs the pharmacy dispense permission.</p>}
    </div>
  </Drawer>;
}
