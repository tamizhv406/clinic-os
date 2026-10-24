import { Button } from "../../../components/ui";
import type { Invoice } from "../types";
import { billTypeLabel, rupee } from "../utils";
import { InvoiceCard } from "./InvoiceCard";
import { PaymentModeBadge } from "./PaymentModeBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

export function InvoiceTable({ invoices, onView }: { invoices: Invoice[]; onView?: (invoice: Invoice) => void }) {
  if (invoices.length === 0) return <p className="text-sm text-slate-500">No invoices match the current filters.</p>;

  return <>
    <div className="grid gap-4 md:hidden">{invoices.map((invoice) => <InvoiceCard key={invoice.id} invoice={invoice} onView={onView ? () => onView(invoice) : undefined} />)}</div>
    <div className="table-wrap hidden md:block"><table className="data-table">
      <thead><tr><th>Invoice</th><th>Patient</th><th>Phone</th><th>Type</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Mode</th><th>Date</th>{onView && <th>Actions</th>}</tr></thead>
      <tbody>{invoices.map((invoice) => <tr key={invoice.id}>
        <td className="font-semibold">{invoice.id}</td>
        <td>{invoice.patientName}</td>
        <td>{invoice.phone}</td>
        <td>{billTypeLabel[invoice.billType]}</td>
        <td>{rupee(invoice.total)}</td>
        <td>{rupee(invoice.paidAmount)}</td>
        <td>{rupee(invoice.balance)}</td>
        <td><PaymentStatusBadge status={invoice.paymentStatus} /></td>
        <td><PaymentModeBadge mode={invoice.paymentMode} /></td>
        <td>{invoice.date}</td>
        {onView && <td><Button className="min-h-8 px-3 py-1" onClick={() => onView(invoice)}>View</Button></td>}
      </tr>)}</tbody>
    </table></div>
  </>;
}
