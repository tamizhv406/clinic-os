import { services } from "../services/serviceProvider";
import { useAsyncData } from "./useAsyncData";

export function usePharmacyQueue(branchId?: string) {
  return useAsyncData(() => services.pharmacy.getPharmacyOrders(branchId), [branchId]);
}
