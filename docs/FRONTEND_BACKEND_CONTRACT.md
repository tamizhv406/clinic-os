# Frontend Backend Contract

This frontend is prepared for API-backed data without changing screen components.

## Service Boundary

Use `src/services/serviceProvider.ts` as the composition point:

- `auth`: current user, login, logout.
- `clinics`: clinic, branches, modules.
- `users`: roles, staff users, permission checks.
- `appointments`: appointment list, creation, queue, reschedule, cancellation.
- `patients`: patient records and clinical timeline.
- `doctor`: availability, consultation queue, prescriptions, reminders.
- `pharmacy`: medicines, stock, prescription queue, pharmacy orders.
- `billing`: invoices, payments, refunds, revenue reporting.
- `whatsapp`: conversations, booking flow, confirmations, reminders.
- `reports`: dashboard and module reports.
- `support`: support tickets.

Each service has a TypeScript interface in `src/services/interfaces/` and a mock implementation in `src/services/mock/`.

## Access Control

- Role/module/permission constants live in `src/access-control/`.
- `getNavigationForUser()` filters navigation by enabled clinic modules and user permissions.
- Route or component access can use `ModuleGuard`, `PermissionGuard`, or `canAccess()`.
- There is no patient login role. Patients are records and communicate through WhatsApp/public booking.

## Expected API Shape

API responses should match the shared domain types where possible. Lists can return `PaginatedResponse<T>`. Failures should map to `ServiceError` with `code`, `message`, and optional `details`.

