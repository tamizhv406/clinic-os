# Phase 6.5 Workflow Fix Gate

## Issues Found

- Route access relied mostly on sidebar filtering, so direct URLs could still reach unrelated modules.
- Sidebar permission checks did not consistently support full Supabase permission keys such as `patients.view`.
- App layout briefly fell back to owner role while auth context loaded.
- Logout was not a clear visible topbar action.
- Super Admin module and permission selections were only applied during creation, not to existing clinics/staff.
- Reception patient registration was a no-op mock flow.
- Reception appointments and queue pages used legacy mock wrappers.
- Doctor availability and doctor queue pages used legacy mock wrappers.

## Files Fixed

- `src/access-control/canAccess.ts`
- `src/access-control/ModuleGuard.tsx`
- `src/routes/AppRoutes.tsx`
- `src/routes/ProtectedRoute.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/Topbar.tsx`
- `src/components/layout/navigation.ts`
- `src/pages/super-admin/SuperAdminDashboard.tsx`
- `src/modules/reception/components/PatientRegistrationForm.tsx`
- `src/modules/reception/components/AppointmentFormModal.tsx`
- `src/modules/reception/components/AppointmentTable.tsx`
- `src/modules/reception/components/AppointmentCard.tsx`
- `src/modules/reception/pages/Appointments.tsx`
- `src/modules/reception/pages/Queue.tsx`
- `src/modules/reception/pages/ReceptionDashboard.tsx`
- `src/modules/doctor/components/BlockedDateModal.tsx`
- `src/modules/doctor/pages/Availability.tsx`
- `src/modules/doctor/pages/DoctorQueue.tsx`
- `src/services/interfaces/doctor.service.ts`
- `src/services/supabase/supabaseDoctor.service.ts`
- `src/services/mock/mockDoctor.service.ts`

## Role Visibility Result

- Sidebar navigation is filtered by authenticated `role_key`, enabled clinic modules, staff modules, and permissions.
- Route access now checks module, permission, and allowed role.
- RoleSwitcher remains read-only.
- Patient portal/auth was not added.

## Logout Result

- Topbar now includes a visible logout action.
- Logout calls Supabase Auth `signOut()`, clears legacy demo localStorage keys, clears auth context event state, and redirects to `/login`.
- Protected routes clear stale demo auth keys when session/profile loading fails.

## Admin Workflow Result

- Super Admin clinic list/create/status/branch/staff flows remain service-backed.
- Existing clinic module assignment can now be saved to `clinic_modules`.
- Existing staff module/permission assignment can now be synced to `staff_modules` and `staff_permissions`.

## Patient Workflow Result

- Reception/owner patient form now creates patients through `services.patients`.
- Search supports name, phone, WhatsApp number, and patient code through the Supabase patient service.
- Edit patient persists through `services.patients.updatePatient`.
- Supabase/RLS failures surface through toast errors.

## Appointment Workflow Result

- Reception appointments load through `services.appointments`.
- Appointment creation selects existing patient, doctor profile, date, and slot.
- Slot generation uses `services.doctor.generateSlotsForDoctor`.
- Booking uses `services.appointments.bookAppointmentWithSlot`.
- Appointment status actions persist through `services.appointments.updateAppointmentStatus`.
- Reception queue and doctor queue read persisted appointments.

## Double-Booking Result

- UI booking path uses the `create_appointment_with_slot` RPC, which locks the selected slot and increments `booked_count`.
- Expected behavior: first booking succeeds, second booking fails when capacity is full, and the slot becomes full.
- Real browser double-booking verification still requires real test users and data.

## Remaining Risks

- Real five-role browser verification was not completed in this session because Phase 4.5 test users were not available.
- RLS behavior must still be verified against the linked Supabase project using real `super_admin`, `owner`, `receptionist`, `doctor`, and `pharmacist` accounts.
- Billing, WhatsApp, reports, consultation, prescription, and pharmacy feature services remain mocked by phase rule.
- Some dashboard billing preview cards intentionally still use mock data.
