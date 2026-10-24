import { BrandLogo } from "../../../components/ui";
import { useClinicProfile } from "../../../hooks/useClinicProfile";
import type { Receipt } from "../types";
import { paymentModeLabel, rupee } from "../utils";

export function ReceiptPreview({ receipt }: { receipt: Receipt }) {
  const clinic = useClinicProfile();
  return <div className="card max-w-md p-5">
    <div className="flex items-center gap-4 border-b pb-4">
      <BrandLogo className="size-12" />
      <div>
        <h2 className="font-['Manrope'] font-semibold">{clinic.name || "Clinic"}</h2>
        <p className="text-xs text-slate-500">Receipt {receipt.id}</p>
      </div>
    </div>
    <div className="mt-4 space-y-2 text-sm">
      <p><b>Patient:</b> {receipt.patientName}</p>
      <p><b>Amount paid:</b> {rupee(receipt.amountPaid)}</p>
      <p><b>Mode:</b> {paymentModeLabel[receipt.paymentMode]}</p>
      <p><b>Date:</b> {receipt.dateTime}</p>
      <p><b>Linked invoice:</b> {receipt.linkedInvoice}</p>
    </div>
    {clinic.address && <p className="mt-4 border-t pt-3 text-center text-xs text-slate-400">{clinic.address}</p>}
  </div>;
}
