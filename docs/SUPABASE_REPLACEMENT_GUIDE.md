# Supabase Replacement Guide

Replace mocks by swapping implementations behind `src/services/serviceProvider.ts`.

## Suggested Steps

1. Create Supabase-backed implementations beside `src/services/mock/`, for example `src/services/supabase/supabaseAppointment.service.ts`.
2. Keep each implementation conforming to the matching interface in `src/services/interfaces/`.
3. Convert Supabase rows to `src/shared/types/domain.ts` records at the service boundary.
4. Update `serviceProvider.ts` to choose mock or Supabase services by environment flag.
5. Keep screens on hooks/services only, with no direct Supabase calls in modules.

## Table Mapping

- `clinics`, `branches`, `users`, `roles`.
- `patients`, `appointments`, `doctor_availability`, `consultations`.
- `prescriptions`, `prescription_items`, `medicines`, `inventory`.
- `pharmacy_orders`, `invoices`, `payments`.
- `whatsapp_conversations`, `reminders`, `support_tickets`, `reports`.

## Auth Notes

Supabase Auth should create staff sessions only for owner, receptionist, doctor, pharmacist, and super admin roles. Patient identity belongs in `patients` plus WhatsApp/public booking records, not auth users.

