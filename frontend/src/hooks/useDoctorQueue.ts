import { services } from "../services/serviceProvider";
import { useAsyncData } from "./useAsyncData";

export function useDoctorQueue(doctorId: string) {
  return useAsyncData(() => services.appointments.getAppointments({ doctorId }), [doctorId]);
}
