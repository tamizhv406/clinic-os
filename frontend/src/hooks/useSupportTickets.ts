import { services } from "../services/serviceProvider";
import { useAsyncData } from "./useAsyncData";

export function useSupportTickets(clinicId?: string) {
  return useAsyncData(() => services.support.getTickets(clinicId), [clinicId]);
}
