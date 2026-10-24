import { services } from "../services/serviceProvider";
import { useAsyncData } from "./useAsyncData";

export function useWhatsAppConversations(clinicId?: string) {
  return useAsyncData(() => services.whatsapp.getConversations(clinicId), [clinicId]);
}
