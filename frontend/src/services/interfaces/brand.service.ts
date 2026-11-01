export type BrandRecord = { id: string; name: string; slug: string; status: string };

export type MyClinic = {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  clinicStatus: string;
  organizationId: string | null;
  organizationName: string | null;
  isActive: boolean;
};

export type ClinicAccessRecord = { staffId: string; clinicId: string };

export type CreateClinicInput = {
  name: string;
  slug: string;
  clinicMode: "single_speciality" | "multi_speciality";
  specialty?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** Add the clinic to an existing brand, or leave empty and name a new one. */
  organizationId?: string | null;
  newOrganizationName?: string;
};

export interface BrandService {
  getBrands(): Promise<BrandRecord[]>;
  /** Maps clinic id -> brand id for every clinic the caller can read. */
  getClinicBrandIds(): Promise<Map<string, string | null>>;
  createClinic(input: CreateClinicInput): Promise<{ clinicId: string; branchId: string; organizationId: string }>;
  /** Clinics the signed-in staff member may work in (empty for platform admins). */
  getMyClinics(): Promise<MyClinic[]>;
  switchActiveClinic(clinicId: string): Promise<void>;
  /** Who has access to which clinic (staff_clinic_access rows visible to the caller). */
  getClinicAccess(clinicId?: string): Promise<ClinicAccessRecord[]>;
  grantClinicAccess(staffId: string, clinicId: string, branchId?: string | null): Promise<void>;
  revokeClinicAccess(staffId: string, clinicId: string): Promise<void>;
}
