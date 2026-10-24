import { services } from "../services/serviceProvider";
import { useAsyncData } from "./useAsyncData";

export function useClinicContext(clinicId?: string) {
  return useAsyncData(async () => {
    if (clinicId) {
      return { clinic: await services.clinics.getClinicById(clinicId), branches: await services.clinics.getBranches(clinicId), enabledModules: await services.clinics.getEnabledModules(clinicId) };
    }

    const context = await services.auth.getCurrentAuthContext();
    return { clinic: context.clinic, branches: context.branch ? [context.branch] : [], enabledModules: context.enabledModules };
  }, [clinicId]);
}
