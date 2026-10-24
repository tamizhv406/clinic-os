import { Button } from "../../../components/ui";
import type { Refund, RefundStatus } from "../types";
import { rupee } from "../utils";
import { RefundStatusBadge } from "./PaymentStatusBadge";

export function RefundRequestCard({ refund, saving = false, onUpdateStatus }: { refund: Refund; saving?: boolean; onUpdateStatus?: (status: RefundStatus) => void }) {
  return <div className="card p-4">
    <div className="flex justify-between gap-4">
      <div>
        <b className="text-xs uppercase tracking-wide text-slate-400">{refund.id.slice(0, 8)}</b>
        <h3 className="font-semibold">{refund.patientName}</h3>
        <p className="text-sm text-slate-500">{refund.invoiceNumber} · {refund.reason}</p>
      </div>
      <RefundStatusBadge status={refund.status} />
    </div>
    <p className="mt-3 text-sm">Original {rupee(refund.originalAmount)} · Refund <b>{rupee(refund.refundAmount)}</b> · {refund.date}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button disabled={saving || refund.status !== "requested"} onClick={() => onUpdateStatus?.("approved")}>Approve</Button>
      <Button variant="ghost" disabled={saving || refund.status !== "requested"} onClick={() => onUpdateStatus?.("rejected")}>Reject</Button>
      <Button variant="secondary" disabled={saving || refund.status !== "approved"} onClick={() => onUpdateStatus?.("processed")}>Mark processed</Button>
    </div>
  </div>;
}
