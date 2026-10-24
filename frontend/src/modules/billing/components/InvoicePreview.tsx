import { BrandLogo } from "../../../components/ui";
import { useClinicProfile } from "../../../hooks/useClinicProfile";
import type { Invoice } from "../types";
import { billTypeLabel, paymentModeLabel, paymentStatusLabel, rupee } from "../utils";

export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const clinic = useClinicProfile();
  return <div className="card p-4 md:p-5">
    <div className="flex items-center justify-between border-b pb-4">
      <div className="flex items-center gap-4">
        <BrandLogo className="size-14" />
        <div>
          <h2 className="font-['Manrope'] font-semibold">{clinic.name || "Clinic"}</h2>
          <p className="text-xs text-slate-500">{[clinic.address, clinic.phone].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <p className="text-right text-sm"><b>{invoice.id}</b><br />{invoice.date}</p>
    </div>
    <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
      <p><b>Patient:</b> {invoice.patientName}</p>
      <p><b>Phone:</b> {invoice.phone}</p>
      <p><b>Doctor:</b> {invoice.doctorName || "—"}</p>
      <p><b>Bill type:</b> {billTypeLabel[invoice.billType]}</p>
    </div>
    <div className="mt-4 overflow-x-auto"><table className="data-table min-w-[560px]">
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead>
      <tbody>{invoice.items.map((item) => <tr key={item.id}>
        <td>{item.name}</td><td>{item.quantity}</td><td>{rupee(item.unitPrice)}</td>
        <td>{rupee(item.discount)}</td><td>{rupee(item.tax)}</td>
        <td>{rupee(item.quantity * item.unitPrice - item.discount + item.tax)}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="mt-4 space-y-1 text-right text-sm">
      <p>Subtotal: <b>{rupee(invoice.subtotal)}</b></p>
      <p>Discount: <b>{rupee(invoice.discount)}</b></p>
      <p>Tax: <b>{rupee(invoice.tax)}</b></p>
      <p className="text-lg">Total: <b>{rupee(invoice.total)}</b></p>
      <p>Paid: <b>{rupee(invoice.paidAmount)}</b> · Balance: <b>{rupee(invoice.balance)}</b></p>
      <p>{paymentModeLabel[invoice.paymentMode]} · {paymentStatusLabel[invoice.paymentStatus]}</p>
    </div>
  </div>;
}
