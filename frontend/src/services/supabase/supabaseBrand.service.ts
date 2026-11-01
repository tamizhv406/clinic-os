import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import type { BrandService } from "../interfaces";

// The generated Database type predates brands and multi-clinic access, so this
// service talks to those objects through an untyped handle. Regenerating the types
// (supabase gen types) removes the need for the cast.
const db = supabase as unknown as SupabaseClient;

function fail(error: { message: string } | null): never {
  throw new Error(error?.message ?? "Request failed.");
}

export const supabaseBrandService: BrandService = {
  async getBrands() {
    const { data, error } = await db.from("organizations").select("id, name, slug, status").order("name");
    if (error) fail(error);
    return data ?? [];
  },

  async getClinicBrandIds() {
    const { data, error } = await db.from("clinics").select("id, organization_id");
    if (error) fail(error);
    return new Map((data ?? []).map((row) => [row.id as string, (row.organization_id as string | null) ?? null]));
  },

  async createClinic(input) {
    const { data, error } = await db.rpc("create_clinic_with_defaults", {
      clinic_name: input.name,
      clinic_slug: input.slug,
      clinic_mode: input.clinicMode,
      clinic_specialty: input.specialty ?? null,
      clinic_phone: input.phone ?? null,
      clinic_email: input.email ?? null,
      clinic_address: input.address ?? null,
      for_organization_id: input.organizationId || null,
      new_organization_name: input.newOrganizationName ?? null,
    });
    if (error) fail(error);
    return { clinicId: data.clinic_id, branchId: data.branch_id, organizationId: data.organization_id };
  },

  async getMyClinics() {
    const { data, error } = await db.rpc("my_clinics");
    if (error) fail(error);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      clinicId: row.clinic_id as string,
      clinicName: row.clinic_name as string,
      clinicSlug: row.clinic_slug as string,
      clinicStatus: row.clinic_status as string,
      organizationId: (row.organization_id as string | null) ?? null,
      organizationName: (row.organization_name as string | null) ?? null,
      isActive: Boolean(row.is_active),
    }));
  },

  async switchActiveClinic(clinicId) {
    const { error } = await db.rpc("switch_active_clinic", { target_clinic_id: clinicId });
    if (error) fail(error);
  },

  async getClinicAccess(clinicId) {
    let query = db.from("staff_clinic_access").select("staff_id, clinic_id");
    if (clinicId) query = query.eq("clinic_id", clinicId);
    const { data, error } = await query;
    if (error) fail(error);
    return (data ?? []).map((row) => ({ staffId: row.staff_id as string, clinicId: row.clinic_id as string }));
  },

  async grantClinicAccess(staffId, clinicId, branchId) {
    const { error } = await db.rpc("grant_clinic_access", { target_staff_id: staffId, target_clinic_id: clinicId, target_branch_id: branchId ?? null });
    if (error) fail(error);
  },

  async revokeClinicAccess(staffId, clinicId) {
    const { error } = await db.rpc("revoke_clinic_access", { target_staff_id: staffId, target_clinic_id: clinicId });
    if (error) fail(error);
  },
};
