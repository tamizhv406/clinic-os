import { Button } from "../../../components/ui";
import type { Invoice } from "../types";
import { billTypeLabel, rupee } from "../utils";
import { PaymentModeBadge } from "./PaymentModeBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

export function InvoiceCard({ invoice, onView }: { invoice: Invoice; onView?: () => void }) {
  return <div className="card p-4">
    <div className="flex justify-between gap-4">
      <div>
        <b>{invoice.id}</b>
        <h3 className="font-['Manrope'] text-lg font-semibold">{invoice.patientName}</h3>
        <p className="text-xs text-slate-500">{invoice.phone} · {billTypeLabel[invoice.billType]}</p>
      </div>
      <b>{rupee(invoice.total)}</b>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <PaymentStatusBadge status={invoice.paymentStatus} />
      <PaymentModeBadge mode={invoice.paymentMode} />
    </div>
    <p className="mt-2 text-sm text-slate-500">Paid {rupee(invoice.paidAmount)} · Balance {rupee(invoice.balance)}</p>
    {onView && <div className="mt-4 flex flex-wrap gap-2"><Button onClick={onView}>View invoice</Button></div>}
  </div>;
}
