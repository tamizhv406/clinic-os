import { BrandLogo } from "../../../components/ui";
import { useClinicProfile } from "../../../hooks/useClinicProfile";
import type { PharmacyBillItem, PaymentMode, PaymentStatus } from "../types";
import { paymentLabel, paymentModeLabel, rupee } from "../utils";

export function PharmacyBillPreview({ items, paymentMode, paymentStatus, patientName = "", doctorName = "" }: { items: PharmacyBillItem[]; paymentMode: PaymentMode; paymentStatus: PaymentStatus; patientName?: string; doctorName?: string }) {
  const clinic = useClinicProfile();
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = items.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal - discount;
  const today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  return <div className="card p-4 md:p-5">
    <div className="flex items-center justify-between border-b pb-4">
      <div className="flex items-center gap-4">
        <BrandLogo className="size-14" />
        <div>
          <h2 className="font-['Manrope'] font-semibold">{clinic.name || "Pharmacy"}</h2>
          <p className="text-xs text-slate-500">Pharmacy bill · {today}</p>
        </div>
      </div>
      <p className="text-right text-sm"><b>{patientName || "Counter sale"}</b>{doctorName ? <><br />{doctorName}</> : null}</p>
    </div>
    <div className="mt-4 overflow-x-auto"><table className="data-table min-w-[520px]">
      <thead><tr><th>Medicine</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Total</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.medicineName}>
        <td>{item.medicineName}</td><td>{item.quantity}</td><td>{rupee(item.unitPrice)}</td>
        <td>{rupee(item.discount)}</td><td>{rupee(item.quantity * item.unitPrice - item.discount)}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="mt-4 space-y-1 text-right text-sm">
      <p>Subtotal: <b>{rupee(subtotal)}</b></p>
      <p>Discount: <b>{rupee(discount)}</b></p>
      <p className="text-lg">Total: <b>{rupee(total)}</b></p>
      <p>{paymentModeLabel[paymentMode]} · {paymentLabel[paymentStatus]}</p>
    </div>
  </div>;
}
