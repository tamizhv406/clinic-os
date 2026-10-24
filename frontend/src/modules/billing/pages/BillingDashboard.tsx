import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { BillingStatsGrid } from "../components/BillingStatsGrid";
import { InvoiceTable } from "../components/InvoiceTable";
import { PaymentModeBadge } from "../components/PaymentModeBadge";
import { PendingPaymentCard } from "../components/PendingPaymentCard";
import { RevenueChart } from "../components/RevenueChart";
import { TopServicesTable } from "../components/TopServicesTable";
import { toInvoice, toPendingPayment } from "../supabaseMappers";
import type { Invoice, PendingPayment, RevenueReport } from "../types";
import { rupee } from "../utils";

const emptyReport: RevenueReport = { totalRevenue: 0, consultationRevenue: 0, pharmacyRevenue: 0, procedureRevenue: 0, pendingAmount: 0, refundAmount: 0, trend: [], paymentModes: [], topServices: [] };

export default function BillingDashboard() {
  const [q, setQ] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [report, setReport] = useState<RevenueReport>(emptyReport);
  const [refundTotal, setRefundTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [context, summaries, nextReport, nextRefunds] = await Promise.all([services.auth.getCurrentAuthContext(), services.billing.getInvoices(), services.reports.getRevenueSummary(), services.catalog.getRefunds()]);
        const details = await Promise.all(summaries.map((invoice) => services.billing.getInvoiceById(invoice.id)));
        const valid = details.filter(Boolean);
        setClinicName((context.clinic as { name?: string } | null)?.name ?? "");
        setRefundTotal(nextRefunds.filter((refund) => refund.status === "processed").reduce((total, refund) => total + refund.refundAmount, 0));
        setInvoices(valid.map((detail) => toInvoice(detail!, detail!.items, detail!.patient)));
        setPending(valid.filter((detail) => (detail!.balance_amount ?? 0) > 0 && detail!.invoice_status !== "cancelled").map((detail) => toPendingPayment(detail!, detail!.patient)));
        setReport(nextReport);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load billing dashboard.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredInvoices = useMemo(() => invoices.filter((invoice) => `${invoice.id} ${invoice.patientName} ${invoice.phone}`.toLowerCase().includes(q.toLowerCase())).slice(0, 5), [invoices, q]);
  const stats = {
    todayRevenue: invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
    consultationRevenue: invoices.filter((invoice) => invoice.billType === "consultation").reduce((sum, invoice) => sum + invoice.paidAmount, 0),
    pharmacyRevenue: invoices.filter((invoice) => invoice.billType === "pharmacy").reduce((sum, invoice) => sum + invoice.paidAmount, 0),
    pendingPayments: pending.reduce((sum, payment) => sum + payment.balance, 0),
    partialPayments: invoices.filter((invoice) => invoice.paymentStatus === "partial").length,
    refunds: refundTotal,
    billsGenerated: invoices.length,
    onlinePaymentLinks: invoices.filter((invoice) => invoice.paymentMode === "online_link").length,
  };

  const subtitle = loading ? "Loading billing data..." : [clinicName, new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })].filter(Boolean).join(" - ");

  return <div className="space-y-6"><PageHeader title="Billing Overview" description={subtitle} action={<Button to="/billing/create">Create Bill</Button>} /><Input placeholder="Search by patient, phone, bill number" value={q} onChange={(e) => setQ(e.target.value)} /><BillingStatsGrid stats={stats} /><div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Card className="p-4 md:p-5"><h2 className="font-semibold">Revenue Trend</h2>{report.trend.length > 0 ? <RevenueChart data={report.trend} /> : <p className="mt-4 text-sm text-slate-500">No collections recorded for this period yet.</p>}</Card><Card className="p-4 md:p-5"><h2 className="font-semibold">Payment Mode Split</h2><div className="mt-4 space-y-3">{report.paymentModes.length > 0 ? report.paymentModes.map((m) => <div key={m.mode} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><PaymentModeBadge mode={m.mode} /><b>{rupee(m.amount)}</b></div>) : <p className="text-sm text-slate-500">No payments recorded yet.</p>}</div></Card></div><Card className="p-4 md:p-5"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Recent Invoices</h2><Link className="text-sm font-semibold text-brand-700" to="/billing/invoices">View all</Link></div><InvoiceTable invoices={filteredInvoices} /></Card><div className="grid gap-4 xl:grid-cols-2"><Card className="p-4 md:p-5"><h2 className="font-semibold">Pending Payments</h2><div className="mt-4 space-y-3">{pending.length > 0 ? pending.map((p) => <PendingPaymentCard key={p.id} payment={p} />) : <p className="text-sm text-slate-500">Every invoice is fully settled.</p>}</div></Card><Card className="p-4 md:p-5"><h2 className="font-semibold">Top Services</h2><TopServicesTable rows={report.topServices} /></Card></div></div>;
}
