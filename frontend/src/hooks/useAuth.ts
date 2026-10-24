import { services } from "../services/serviceProvider";

export function useAuth() {
  return services.auth;
}
