import { useEffect, useState } from "react";
import { services } from "../services/serviceProvider";

export type ClinicProfile = {
  name: string;
  address: string;
  phone: string;
  email: string;
};

const empty: ClinicProfile = { name: "", address: "", phone: "", email: "" };

let cached: Promise<ClinicProfile> | null = null;

/**
 * Clinic letterhead details for printed documents (invoices, receipts,
 * prescriptions). Fetched once per session and shared across previews.
 */
function loadClinicProfile(): Promise<ClinicProfile> {
  if (!cached) {
    cached = services.auth
      .getCurrentAuthContext()
      .then((context) => {
        const clinic = context.clinic as { name?: string; address?: string; phone?: string; email?: string } | null;
        return {
          name: clinic?.name ?? "",
          address: clinic?.address ?? "",
          phone: clinic?.phone ?? "",
          email: clinic?.email ?? "",
        };
      })
      .catch(() => empty);
  }
  return cached;
}

export function useClinicProfile(): ClinicProfile {
  const [profile, setProfile] = useState<ClinicProfile>(empty);
  useEffect(() => {
    let mounted = true;
    void loadClinicProfile().then((next) => { if (mounted) setProfile(next); });
    return () => { mounted = false; };
  }, []);
  return profile;
}
