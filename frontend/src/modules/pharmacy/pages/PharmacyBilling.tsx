import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader, StatusBadge } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { localDateISO } from "../../../utils/formatDate";
import { PharmacyBillBuilder } from "../components/PharmacyBillBuilder";
import type { PharmacyBill } from "../types";
import { paymentLabel, paymentModeLabel, rupee } from "../utils";

/** Counter Billing: quick sale plus today's pharmacy bills. */
export default function PharmacyBilling() {
  const today = useMemo(() => localDateISO(), []);
  const [bills, setBills] = useState<PharmacyBill[] | null>(null);
  const [error, setError] = useState("");
  const loadBills = useCallback(async () => {
    setError("");
    try { setBills(await services.pharmacy.getPharmacyBills(today, 200)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load today's bills."); }
  }, [today]);
  useEffect(() => { void loadBills(); }, [loadBills]);
  const total = (bills ?? []).reduce((sum, bill) => sum + bill.total, 0);

  return <div className="space-y-6">
    <PageHeader title="Counter Billing" description="Sell from stock: batches are taken earliest-expiry first and stock is reduced when the sale is saved." />
    <PharmacyBillBuilder onSaved={() => void loadBills()} />
    <section className="card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Today's bills</h2>{bills && <p className="text-sm text-slate-500">{bills.length} bill{bills.length === 1 ? "" : "s"} · {rupee(total)}</p>}</div>
      <div className="mt-3">{error ? <ErrorState title="Could not load today's bills" description={error} onRetry={() => void loadBills()} />
        : bills === null ? <LoadingSkeleton variant="table" rows={3} />
        : bills.length === 0 ? <EmptyState title="No bills yet today" description="Saved counter sales and prescription bills appear here." />
        : <div className="overflow-x-auto"><table className="data-table min-w-[560px]"><thead><tr><th>Bill</th><th>Patient</th><th>Time</th><th className="numeric">Items</th><th className="numeric">Total</th><th>Payment</th></tr></thead>
          <tbody>{bills.map((bill) => <tr key={bill.id}><td className="font-medium">{bill.id}</td><td>{bill.patientName}</td><td>{bill.createdAt}</td><td className="numeric">{bill.items.length}</td><td className="numeric">{rupee(bill.total)}</td><td><StatusBadge tone={bill.paymentStatus === "paid" ? "success" : bill.paymentStatus === "partial" ? "warning" : "neutral"}>{paymentLabel[bill.paymentStatus]} · {paymentModeLabel[bill.paymentMode]}</StatusBadge></td></tr>)}</tbody>
        </table></div>}</div>
    </section>
  </div>;
}
