import { services } from "../services/serviceProvider";
import { useAsyncData } from "./useAsyncData";

export function useCurrentUser() {
  return useAsyncData(() => services.auth.getCurrentUser(), []);
}
