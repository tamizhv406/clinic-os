import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, LoadingSkeleton, PageHeader, Tabs } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { CreatePurchaseEntryInput, StockPurchaseSummary } from "../../../services/interfaces";
import type { Tables } from "../../../shared/types/database.types";
import { localDateISO } from "../../../utils/formatDate";
import { PurchaseEntryForm } from "../components/PurchaseEntryForm";
import { StockExcelImport } from "../components/StockExcelImport";
import { StockPurchaseHistory } from "../components/StockPurchaseHistory";
import { medicineKey } from "../stockImport";
import type { Supplier } from "../types";
import { rupee } from "../utils";

type TabId = "manual" | "excel" | "history";
const TABS: { id: TabId; label: string }[] = [
  { id: "manual", label: "Manual entry" },
  { id: "excel", label: "Excel / CSV upload" },
  { id: "history", label: "History" },
];
const isTab = (value: string | null): value is TabId => TABS.some((tab) => tab.id === value);

const summaryText = (summary: StockPurchaseSummary) =>
  `Saved ${summary.items} item${summary.items === 1 ? "" : "s"} (${rupee(summary.totalAmount)}): ${summary.batchesCreated} new batch${summary.batchesCreated === 1 ? "" : "es"}, ${summary.batchesToppedUp} topped up, ${summary.medicinesCreated} new medicine${summary.medicinesCreated === 1 ? "" : "s"}.`;

export default function AddStock() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = isTab(searchParams.get("tab")) ? (searchParams.get("tab") as TabId) : "manual";
  const prefillMedicine = searchParams.get("medicine") ?? undefined;
  const today = useMemo(() => localDateISO(), []);

  const [catalog, setCatalog] = useState<Tables<"medicines">[] | null>(null);
  const [batches, setBatches] = useState<Tables<"medicine_stock_batches">[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const loadReference = useCallback(async () => {
    setLoadError("");
    try {
      const [nextCatalog, nextBatches, nextSuppliers] = await Promise.all([
        services.pharmacy.getMedicineCatalog({ status: "active" }),
        services.pharmacy.getStockBatches(),
        services.catalog.getSuppliers(),
      ]);
      setCatalog(nextCatalog);
      setBatches(nextBatches);
      setSuppliers(nextSuppliers);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load medicines and suppliers.");
    }
  }, []);

  useEffect(() => { void loadReference(); }, [loadReference]);

  const lastBatchByMedicine = useMemo(() => {
    const latest = new Map<string, Tables<"medicine_stock_batches">>();
    for (const batch of batches) {
      const current = latest.get(batch.medicine_id);
      if (!current || (batch.created_at ?? "") > (current.created_at ?? "")) latest.set(batch.medicine_id, batch);
    }
    return latest;
  }, [batches]);
  const knownMedicineNames = useMemo(() => new Set((catalog ?? []).map((medicine) => medicineKey(medicine.name))), [catalog]);

  const changeTab = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    if (id !== "manual") next.delete("medicine");
    setSearchParams(next, { replace: true });
  };

  const save = async (input: CreatePurchaseEntryInput): Promise<StockPurchaseSummary | null> => {
    setSaving(true);
    try {
      const summary = await services.catalog.createPurchaseEntry(input);
      toast.success(summaryText(summary));
      setHistoryKey((key) => key + 1);
      void loadReference();
      return summary;
    } catch (error) {
      // The database lists every invalid row in one message; show it in full.
      toast.error(error instanceof Error ? error.message : "The purchase was not saved.", { duration: 12000 });
      return null;
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-5">
    <PageHeader title="Add Stock" description="Receive a supplier invoice by hand or from an Excel/CSV file. Quantities are always added to existing batches." />
    <Tabs items={TABS} value={tab} onChange={changeTab} />
    {tab === "history" ? <StockPurchaseHistory suppliers={suppliers} today={today} refreshKey={historyKey} />
      : loadError ? <ErrorState title="Could not load medicines" description={loadError} onRetry={() => void loadReference()} />
      : catalog === null ? <LoadingSkeleton rows={3} />
      : tab === "manual" ? <PurchaseEntryForm key={prefillMedicine ?? "blank"} catalog={catalog} lastBatchByMedicine={lastBatchByMedicine} suppliers={suppliers} today={today} prefillMedicine={prefillMedicine} saving={saving} onSubmit={async (input) => Boolean(await save(input))} />
      : <StockExcelImport knownMedicineNames={knownMedicineNames} suppliers={suppliers} today={today} saving={saving} onImport={save} />}
  </div>;
}
