import { services } from "../services/serviceProvider";
import { useAsyncData } from "./useAsyncData";

export function useReports(clinicId?: string) {
  return useAsyncData(() => services.reports.getReports(clinicId), [clinicId]);
}
