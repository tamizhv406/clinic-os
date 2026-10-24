import type { BranchRecord, ClinicRecord, ModuleKey } from "../../shared/types/domain";
import type { TablesInsert, TablesUpdate } from "../../shared/types/database.types";

export interface ClinicService {
  getClinics(): Promise<ClinicRecord[]>;
  getClinicById(id: string): Promise<ClinicRecord>;
  createClinic(input: TablesInsert<"clinics"> & { enabledModules?: ModuleKey[] }): Promise<ClinicRecord>;
  updateClinic(id: string, input: TablesUpdate<"clinics"> & { enabledModules?: ModuleKey[] }): Promise<ClinicRecord>;
  updateClinicStatus(id: string, status: string): Promise<ClinicRecord>;
  getBranches(clinicId: string): Promise<BranchRecord[]>;
  createBranch(input: TablesInsert<"branches">): Promise<BranchRecord>;
  updateBranch(id: string, input: TablesUpdate<"branches">): Promise<BranchRecord>;
  getEnabledModules(clinicId: string): Promise<ModuleKey[]>;
}
