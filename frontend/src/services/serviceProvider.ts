import { supabaseAppointmentService } from "./supabase/supabaseAppointment.service";
import { supabaseAuthService } from "./supabase/supabaseAuth.service";
import { supabaseBillingDomainService } from "./supabase/supabaseBilling.service";
import { supabaseBookingService } from "./supabase/supabaseBooking.service";
import { supabaseCatalogService } from "./supabase/supabaseCatalog.service";
import { supabaseClinicService } from "./supabase/supabaseClinic.service";
import { supabaseDoctorDomainService } from "./supabase/supabaseDoctor.service";
import { supabaseMonitoringService } from "./supabase/supabaseMonitoring.service";
import { supabasePatientService } from "./supabase/supabasePatient.service";
import { supabasePharmacyDomainService } from "./supabase/supabasePharmacy.service";
import { supabaseReportingService } from "./supabase/supabaseReporting.service";
import { supabaseSupportService } from "./supabase/supabaseSupport.service";
import { supabaseUserService } from "./supabase/supabaseUser.service";
import { supabaseWhatsAppService } from "./supabase/supabaseWhatsApp.service";

/**
 * Every screen reads and writes through this object. There is no mock
 * implementation: each entry talks to Supabase directly.
 */
export const services = {
  auth: supabaseAuthService,
  clinics: supabaseClinicService,
  users: supabaseUserService,
  appointments: supabaseAppointmentService,
  patients: supabasePatientService,
  doctor: supabaseDoctorDomainService,
  pharmacy: supabasePharmacyDomainService,
  billing: supabaseBillingDomainService,
  whatsapp: supabaseWhatsAppService,
  monitoring: supabaseMonitoringService,
  reports: supabaseReportingService,
  support: supabaseSupportService,
  catalog: supabaseCatalogService,
  booking: supabaseBookingService,
};

export type Services = typeof services;
