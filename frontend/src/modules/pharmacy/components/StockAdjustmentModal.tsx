import { useState } from "react";
import { Button, Input, Modal, Select } from "../../../components/ui";
import type { Tables } from "../../../shared/types/database.types";

type BatchRow = Tables<"medicine_stock_batches">;

// adjust_medicine_stock adds for add_stock and subtracts for every other type.
const MOVEMENTS = [
  { value: "damage", label: "Damaged / broken (remove)" },
  { value: "expired", label: "Expired, discarded (remove)" },
  { value: "remove_stock", label: "Returned to supplier / other removal" },
  { value: "correction", label: "Count correction (remove)" },
  { value: "add_stock", label: "Found / customer return (add)" },
] as const;

/**
 * Adjusts one batch through adjust_medicine_stock. Mount it with a fresh `key`
 * each time it opens so the fields start clean.
 */
export function StockAdjustmentModal({ open, onClose, batches = [], initialBatchId, onAdjust }: {
  open: boolean;
  onClose: () => void;
  batches?: BatchRow[];
  initialBatchId?: string;
  /** Resolves true when the database accepted the adjustment. */
  onAdjust?: (input: { batchId: string; movementType: string; quantity: number; reason?: string }) => Promise<boolean> | boolean;
}) {
  const [batchId, setBatchId] = useState(initialBatchId ?? "");
  const [movementType, setMovementType] = useState<string>("damage");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const batch = batches.find((item) => item.id === batchId);
  const amount = Number(quantity);
  const removing = movementType !== "add_stock";
  const quantityError = !quantity ? "" : !Number.isInteger(amount) || amount <= 0 ? "Enter a whole number greater than 0" : removing && batch && amount > batch.quantity_available ? `Only ${batch.quantity_available} available in this batch` : "";
  const reasonError = reason.trim().length > 500 ? "Reason is too long (max 500 characters)" : "";
  const valid = Boolean(batch) && Boolean(quantity) && !quantityError && reason.trim().length >= 3 && !reasonError;

  const submit = async () => {
    if (!valid || !onAdjust) return;
    setSaving(true);
    try {
      if (await onAdjust({ batchId, movementType, quantity: amount, reason: reason.trim() })) onClose();
    } finally {
      setSaving(false);
    }
  };

  return <Modal open={open} onClose={onClose} title="Stock adjustment" description="Every adjustment is recorded in the movement history with your name and reason." footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button loading={saving} disabled={!valid} onClick={() => void submit()}>Adjust stock</Button></>}>
    <div className="space-y-3">
      <Select label="Batch" requiredMark value={batchId} onChange={(event) => setBatchId(event.target.value)}>
        <option value="">Select stock batch</option>
        {batches.map((item) => <option key={item.id} value={item.id}>{item.batch_no} · {item.quantity_available} available{item.expiry_date ? ` · exp ${item.expiry_date}` : ""}{item.status && item.status !== "active" ? ` · ${item.status}` : ""}</option>)}
      </Select>
      <Select label="Type" requiredMark value={movementType} onChange={(event) => setMovementType(event.target.value)}>
        {MOVEMENTS.map((movement) => <option key={movement.value} value={movement.value}>{movement.label}</option>)}
      </Select>
      <Input label="Quantity" requiredMark inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} error={quantityError} placeholder="Units" />
      <Input label="Reason" requiredMark value={reason} onChange={(event) => setReason(event.target.value)} error={reasonError} helperText="At least 3 characters, e.g. “strip torn during unpacking”." maxLength={500} />
    </div>
  </Modal>;
}
