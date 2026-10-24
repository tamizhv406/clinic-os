import { Button } from "../../../components/ui";
import type { PendingPayment } from "../types";
import { rupee } from "../utils";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

type Props = {
  payment: PendingPayment;
  busy?: boolean;
  onRecordPayment?: (payment: PendingPayment) => void;
  onSendReminder?: (payment: PendingPayment) => void;
};

export function PendingPaymentCard({ payment, busy = false, onRecordPayment, onSendReminder }: Props) {
  return <div className="card p-4">
    <div className="flex justify-between gap-4">
      <div>
        <h3 className="font-semibold">{payment.patientName}</h3>
        <p className="text-sm text-slate-500">{payment.phone} · {payment.invoiceNumber}</p>
      </div>
      <PaymentStatusBadge status={payment.paymentStatus} />
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
      <p>Total <b>{rupee(payment.totalAmount)}</b></p>
      <p>Paid <b>{rupee(payment.paidAmount)}</b></p>
      <p>Balance <b className="text-warning-700">{rupee(payment.balance)}</b></p>
    </div>
    <p className="mt-2 text-xs text-slate-500">Due since {payment.dueSince}</p>
    {(onRecordPayment || onSendReminder) && <div className="mt-4 flex flex-wrap gap-2">
      {onRecordPayment && <Button disabled={busy} onClick={() => onRecordPayment(payment)}>Record payment</Button>}
      {onSendReminder && <Button variant="secondary" disabled={busy} onClick={() => onSendReminder(payment)}>WhatsApp reminder</Button>}
    </div>}
  </div>;
}
