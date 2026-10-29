import { useEffect, useMemo, useState } from "react";
import { Input, Select } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import type { ReportDateFilter } from "../types";
import { localDateISO, addDaysISO } from "../../../utils/formatDate";

export type ReportFilterValue = { dateFrom?: string; dateTo?: string; doctorId?: string; branchId?: string };

const isoDate = (date: Date) => localDateISO(date);
const shift = (days: number) => addDaysISO(localDateISO(), days);

function rangeFor(preset: ReportDateFilter): { dateFrom?: string; dateTo?: string } {
  const today = isoDate(new Date());
  switch (preset) {
    case "today":
      return { dateFrom: today, dateTo: today };
    case "yesterday":
      return { dateFrom: shift(-1), dateTo: shift(-1) };
    case "last_7_days":
      return { dateFrom: shift(-6), dateTo: today };
    case "this_month": {
      const now = new Date();
      return { dateFrom: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: today };
    }
    default:
      return {};
  }
}

export function ReportFilters({ onChange }: { onChange?: (value: ReportFilterValue) => void }) {
  const [preset, setPreset] = useState<ReportDateFilter>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [profiles, context] = await Promise.all([services.doctor.getDoctorProfiles(), services.auth.getCurrentAuthContext()]);
        const named = await Promise.all(
          profiles.map(async (profile) => {
            try {
              const staff = await services.users.getStaffUserById(profile.staff_id);
              return { id: profile.id, name: staff.fullName };
            } catch {
              return { id: profile.id, name: profile.specialization || profile.department || "Doctor" };
            }
          }),
        );
        const clinicBranches = context.clinic_id ? await services.clinics.getBranches(context.clinic_id) : [];
        if (!mounted) return;
        setDoctors(named);
        setBranches(clinicBranches.map((branch) => ({ id: branch.id, name: branch.name })));
      } catch {
        // Filter options are a convenience; without them the report still covers the whole clinic.
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const value = useMemo((): ReportFilterValue => {
    const range = preset === "custom" ? { dateFrom: customFrom || undefined, dateTo: customTo || undefined } : rangeFor(preset);
    return { ...range, doctorId: doctorId || undefined, branchId: branchId || undefined };
  }, [branchId, customFrom, customTo, doctorId, preset]);

  useEffect(() => { onChange?.(value); }, [value]);

  return <div className="card p-4"><div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
    <Select value={preset} onChange={(event) => setPreset(event.target.value as ReportDateFilter)} aria-label="Date range">
      <option value="today">Today</option>
      <option value="yesterday">Yesterday</option>
      <option value="last_7_days">Last 7 days</option>
      <option value="this_month">This month</option>
      <option value="custom">Custom date range</option>
    </Select>
    <Input type="date" value={customFrom} disabled={preset !== "custom"} onChange={(event) => setCustomFrom(event.target.value)} aria-label="From date" />
    <Input type="date" value={customTo} disabled={preset !== "custom"} onChange={(event) => setCustomTo(event.target.value)} aria-label="To date" />
    <Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} aria-label="Doctor">
      <option value="">All doctors</option>
      {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
    </Select>
    <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="Branch">
      <option value="">All branches</option>
      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
    </Select>
  </div></div>;
}
