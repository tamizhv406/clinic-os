import { supabase } from "../../lib/supabaseClient";
import type { BranchRecord, ClinicRecord, EntityStatus, ModuleKey } from "../../shared/types/domain";
import type { Tables } from "../../shared/types/database.types";
import type { ClinicService } from "../interfaces";

type ClinicRow = Tables<"clinics">;
type BranchRow = Tables<"branches">;

function mapClinic(row: ClinicRow, enabledModules: ModuleKey[] = []): ClinicRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    planId: "",
    status: row.status as EntityStatus,
    ownerUserId: "",
    enabledModules,
    address: row.address ?? "",
    phone: row.phone ?? "",
    city: "",
    state: "",
    settings: (row.settings as Record<string, unknown>) ?? {},
  };
}

function mapBranch(row: BranchRow): BranchRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    name: row.name,
    address: row.address ?? "",
    phone: row.phone ?? "",
    isPrimary: row.is_main ?? false,
  };
}

async function saveClinicModules(clinicId: string, enabledModules?: ModuleKey[]) {
  if (!enabledModules) return;
  const { error: deleteError } = await supabase.from("clinic_modules").delete().eq("clinic_id", clinicId);
  if (deleteError) throw deleteError;
  if (enabledModules.length === 0) return;
  const { error } = await supabase.from("clinic_modules").insert(enabledModules.map((module_key) => ({ clinic_id: clinicId, module_key, enabled: true })));
  if (error) throw error;
}

async function getEnabledModules(clinicId: string) {
  const { data, error } = await supabase.from("clinic_modules").select("module_key").eq("clinic_id", clinicId).eq("enabled", true);
  if (error) throw error;
  return (data ?? []).map((item) => item.module_key as ModuleKey);
}

export const supabaseClinicService: ClinicService = {
  async getClinics() {
    const { data, error } = await supabase.from("clinics").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return Promise.all((data ?? []).map(async (clinic) => mapClinic(clinic, await getEnabledModules(clinic.id))));
  },

  async getClinicById(id) {
    const { data, error } = await supabase.from("clinics").select("*").eq("id", id).single();
    if (error) throw error;
    return mapClinic(data, await getEnabledModules(id));
  },

  async createClinic(input) {
    const { enabledModules, ...clinicInput } = input;
    const { data, error } = await supabase.from("clinics").insert(clinicInput).select("*").single();
    if (error) throw error;
    await saveClinicModules(data.id, enabledModules);
    return mapClinic(data, enabledModules ?? []);
  },

  async updateClinic(id, input) {
    const { enabledModules, ...clinicInput } = input;
    const { data, error } = await supabase.from("clinics").update(clinicInput).eq("id", id).select("*").single();
    if (error) throw error;
    await saveClinicModules(id, enabledModules);
    return mapClinic(data, enabledModules ?? await getEnabledModules(id));
  },

  async updateClinicStatus(id, status) {
    const { data, error } = await supabase.from("clinics").update({ status }).eq("id", id).select("*").single();
    if (error) throw error;
    return mapClinic(data, await getEnabledModules(id));
  },

  async getBranches(clinicId) {
    const { data, error } = await supabase.from("branches").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapBranch);
  },

  async createBranch(input) {
    const { data, error } = await supabase.from("branches").insert(input).select("*").single();
    if (error) throw error;
    return mapBranch(data);
  },

  async updateBranch(id, input) {
    const { data, error } = await supabase.from("branches").update(input).eq("id", id).select("*").single();
    if (error) throw error;
    return mapBranch(data);
  },

  getEnabledModules,
};
