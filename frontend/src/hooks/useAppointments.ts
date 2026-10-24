import type { AppointmentFilters } from "../services/interfaces";
import { services } from "../services/serviceProvider";
import { useAsyncData } from "./useAsyncData";

export function useAppointments(filters?: AppointmentFilters) {
  return useAsyncData(() => services.appointments.getAppointments(filters), [JSON.stringify(filters ?? {})]);
}
