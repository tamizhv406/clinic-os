# Mock Data Guide

Vernex Clinic OS keeps frontend demo data centralized so backend wiring can replace one layer at a time.

## Canonical Mock Layer

- Domain types live in `src/shared/types/domain.ts`.
- Central typed datasets live in `src/mocks/*.mock.ts`.
- Mock latency and resolver behavior live in `src/mocks/mockConfig.ts`.
- Service interfaces live in `src/services/interfaces/`.
- Mock service implementations live in `src/services/mock/`.
- `src/services/serviceProvider.ts` is the active service registry.

## Entity Relationships

- `clinics` own `branches`, enabled modules, and feature flags.
- `users` belong to a clinic and optional branch, carry a role, module list, and permission list.
- `patients` belong to a clinic/branch and are clinical records only, not app login users.
- `appointments` connect patient, doctor, clinic, branch, source, queue, and payment state.
- `doctorAvailability` drives appointment slot and emergency-leave behavior.
- `consultations` connect appointment, patient, doctor, prescription, follow-up, and diagnosis.
- `prescriptions` connect consultation, patient, doctor, medicines, WhatsApp delivery, and reminders.
- `inventory`, `pharmacyOrders`, `invoices`, and `payments` cover stock and revenue workflows.
- `whatsappConversations` and `reminders` model patient communication through WhatsApp.
- `supportTickets` and `reports` support platform/admin workflows.

## Usage Rule

Screens should read data through services or hooks. Raw mocks are allowed inside mock service implementations, compatibility service wrappers, and access-context helpers only.

