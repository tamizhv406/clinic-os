import { services } from "../services/serviceProvider";
import { useAsyncData } from "./useAsyncData";

export function usePatients(clinicId?: string) {
  return useAsyncData(() => services.patients.getPatients(clinicId), [clinicId]);
}
