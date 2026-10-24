import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ModuleGuard } from "../access-control/ModuleGuard";
import { AppLayout } from "../components/layout/AppLayout";
import { LoadingSkeleton } from "../components/ui";
import PlaceholderPage from "../pages/shared/PlaceholderPage";
import ProtectedRoute from "./ProtectedRoute";
import type { ModuleKey, PermissionKey } from "../shared/types/domain";
import type { UserRole } from "../types/user";

const Login = lazy(() => import("../pages/auth/Login"));
const OwnerDashboard = lazy(() => import("../pages/owner/OwnerDashboard"));
const OwnerStaff = lazy(() => import("../pages/owner/OwnerStaff"));
const OwnerSettings = lazy(() => import("../pages/owner/OwnerSettings"));
const ReceptionDashboard = lazy(() => import("../modules/reception/pages/ReceptionDashboard"));
const ReceptionAppointments = lazy(() => import("../modules/reception/pages/Appointments"));
const ReceptionQueue = lazy(() => import("../modules/reception/pages/Queue"));
const ReceptionNewPatient = lazy(() => import("../modules/reception/pages/NewPatient"));
const ReceptionBilling = lazy(() => import("../modules/reception/pages/BillingShortcut"));
const DoctorQueue = lazy(() => import("../modules/doctor/pages/DoctorQueue"));
const DoctorAvailability = lazy(() => import("../modules/doctor/pages/Availability"));
const PatientReminders = lazy(() => import("../modules/doctor/pages/PatientReminders"));
const DoctorPatientProfile = lazy(() => import("../modules/doctor/pages/PatientProfile"));
const DoctorConsultation = lazy(() => import("../modules/doctor/pages/Consultation"));
const DoctorPrescription = lazy(() => import("../modules/doctor/pages/Prescription"));
const DoctorFollowUps = lazy(() => import("../modules/doctor/pages/FollowUps"));
const PharmacyDashboard = lazy(() => import("../modules/pharmacy/pages/PharmacyDashboard"));
const PharmacyPrescriptions = lazy(() => import("../modules/pharmacy/pages/PrescriptionQueue"));
const PharmacyStock = lazy(() => import("../modules/pharmacy/pages/MedicineStock"));
const PharmacyBilling = lazy(() => import("../modules/pharmacy/pages/PharmacyBilling"));
const PharmacyAddStock = lazy(() => import("../modules/pharmacy/pages/AddStock"));
const PharmacyLowStock = lazy(() => import("../modules/pharmacy/pages/LowStock"));
const PharmacyExpiryAlerts = lazy(() => import("../modules/pharmacy/pages/ExpiryAlerts"));
const BillingDashboard = lazy(() => import("../modules/billing/pages/BillingDashboard"));
const BillingCreate = lazy(() => import("../modules/billing/pages/CreateBill"));
const BillingInvoices = lazy(() => import("../modules/billing/pages/Invoices"));
const BillingReceipts = lazy(() => import("../modules/billing/pages/Receipts"));
const BillingPendingPayments = lazy(() => import("../modules/billing/pages/PendingPayments"));
const BillingRefunds = lazy(() => import("../modules/billing/pages/Refunds"));
const BillingReports = lazy(() => import("../modules/billing/pages/Reports"));
const ClinicDirectory = lazy(() => import("../modules/patient-booking/pages/ClinicDirectory"));
const ClinicBookingPage = lazy(() => import("../modules/patient-booking/pages/ClinicBookingPage"));
const BookingFlow = lazy(() => import("../modules/patient-booking/pages/BookingFlow"));
const AppointmentSuccess = lazy(() => import("../modules/patient-booking/pages/AppointmentSuccess"));
const BookingStatus = lazy(() => import("../modules/patient-booking/pages/BookingStatus"));
const Monitoring = lazy(() => import("../pages/shared/Monitoring"));
const WhatsAppBookingDashboard = lazy(() => import("../modules/whatsapp-booking/pages/WhatsAppBookingDashboard"));
const WhatsAppBookingSimulator = lazy(() => import("../modules/whatsapp-booking/pages/WhatsAppBookingSimulator"));
const WhatsAppTemplates = lazy(() => import("../modules/whatsapp-booking/pages/WhatsAppTemplates"));
const WhatsAppConversations = lazy(() => import("../modules/whatsapp-booking/pages/WhatsAppConversations"));
const WhatsAppBookingSettings = lazy(() => import("../modules/whatsapp-booking/pages/WhatsAppBookingSettings"));
const SuperAdminDashboard = lazy(() => import("../pages/super-admin/SuperAdminDashboard"));
const SuperAdminSubscriptions = lazy(() => import("../pages/super-admin/SuperAdminSubscriptions"));
const SuperAdminUsage = lazy(() => import("../pages/super-admin/SuperAdminUsage"));
const SuperAdminSupport = lazy(() => import("../pages/super-admin/SuperAdminSupport"));
const SuperAdminSettings = lazy(() => import("../pages/super-admin/SuperAdminSettings"));

const loading = <main className="p-5 md:p-7"><LoadingSkeleton rows={4} /></main>;
const guarded = (element: ReactNode, module: ModuleKey, roles: UserRole[], permission?: PermissionKey) => <ModuleGuard module={module} roles={roles} permission={permission}>{element}</ModuleGuard>;

export default function AppRoutes() {
  return (
    <Suspense fallback={loading}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/book" element={<ClinicDirectory />} />
        <Route path="/book/:clinicSlug" element={<ClinicBookingPage />} />
        <Route path="/book/:clinicSlug/flow" element={<BookingFlow />} />
        <Route path="/book/:clinicSlug/success" element={<AppointmentSuccess />} />
        <Route path="/booking/status" element={<BookingStatus />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/owner/dashboard" element={guarded(<OwnerDashboard />, "dashboard", ["owner", "admin"])} />
            <Route path="/owner/staff" element={guarded(<OwnerStaff />, "staff", ["owner", "admin"], "manage")} />
            <Route path="/owner/settings" element={guarded(<OwnerSettings />, "settings", ["owner", "admin"], "configure")} />
            <Route path="/reception/dashboard" element={guarded(<ReceptionDashboard />, "dashboard", ["receptionist"])} />
            <Route path="/reception/appointments" element={guarded(<ReceptionAppointments />, "appointments", ["owner", "admin", "receptionist"])} />
            <Route path="/reception/queue" element={guarded(<ReceptionQueue />, "appointments", ["receptionist"])} />
            <Route path="/reception/new-patient" element={guarded(<ReceptionNewPatient />, "patients", ["owner", "admin", "receptionist"])} />
            <Route path="/reception/billing" element={guarded(<ReceptionBilling />, "billing", [], "bill")} />
            <Route path="/doctor/queue" element={guarded(<DoctorQueue />, "appointments", ["doctor"])} />
            <Route path="/doctor/availability" element={guarded(<DoctorAvailability />, "availability", ["doctor"], "configure")} />
            <Route path="/doctor/patient-reminders" element={guarded(<PatientReminders />, "reminders", [])} />
            <Route path="/doctor/patient/:id" element={guarded(<DoctorPatientProfile />, "patients", ["doctor"])} />
            <Route path="/doctor/consultation/:patientId" element={guarded(<DoctorConsultation />, "consultation", ["doctor"])} />
            <Route path="/doctor/prescription/:patientId" element={guarded(<DoctorPrescription />, "prescriptions", [])} />
            <Route path="/doctor/follow-ups" element={guarded(<DoctorFollowUps />, "follow_ups", [])} />
            <Route path="/pharmacy/dashboard" element={guarded(<PharmacyDashboard />, "pharmacy", ["pharmacist", "owner", "admin"])} />
            <Route path="/pharmacy/prescriptions" element={guarded(<PharmacyPrescriptions />, "prescriptions", ["pharmacist", "owner", "admin"])} />
            <Route path="/pharmacy/stock" element={guarded(<PharmacyStock />, "pharmacy", ["pharmacist"])} />
            <Route path="/pharmacy/billing" element={guarded(<PharmacyBilling />, "billing", ["pharmacist", "owner", "admin"], "bill")} />
            <Route path="/pharmacy/add-stock" element={guarded(<PharmacyAddStock />, "pharmacy", ["pharmacist", "owner", "admin"], "manage")} />
            <Route path="/pharmacy/purchase-entry" element={<Navigate to="/pharmacy/add-stock?tab=history" replace />} />
            <Route path="/pharmacy/low-stock" element={guarded(<PharmacyLowStock />, "pharmacy", ["pharmacist"])} />
            <Route path="/pharmacy/expiry-alerts" element={guarded(<PharmacyExpiryAlerts />, "pharmacy", ["pharmacist"])} />
            <Route path="/billing/dashboard" element={guarded(<BillingDashboard />, "billing", [])} />
            <Route path="/billing/create" element={guarded(<BillingCreate />, "billing", [], "bill")} />
            <Route path="/billing/invoices" element={guarded(<BillingInvoices />, "billing", [])} />
            <Route path="/billing/receipts" element={guarded(<BillingReceipts />, "billing", [])} />
            <Route path="/billing/pending-payments" element={guarded(<BillingPendingPayments />, "billing", [])} />
            <Route path="/billing/refunds" element={guarded(<BillingRefunds />, "billing", [])} />
            <Route path="/billing/reports" element={guarded(<BillingReports />, "reports", ["owner", "admin"])} />
            <Route path="/monitoring" element={guarded(<Monitoring />, "reports", ["owner", "admin", "super_admin"])} />
            <Route path="/whatsapp-booking/dashboard" element={guarded(<WhatsAppBookingDashboard />, "whatsapp", [])} />
            <Route path="/whatsapp-booking/simulator" element={guarded(<WhatsAppBookingSimulator />, "whatsapp", [])} />
            <Route path="/whatsapp-booking/templates" element={guarded(<WhatsAppTemplates />, "whatsapp", [])} />
            <Route path="/whatsapp-booking/conversations" element={guarded(<WhatsAppConversations />, "whatsapp", [])} />
            <Route path="/whatsapp-booking/settings" element={guarded(<WhatsAppBookingSettings />, "whatsapp", [], "configure")} />
            <Route path="/super-admin/dashboard" element={guarded(<SuperAdminDashboard />, "dashboard", ["super_admin"])} />
            <Route path="/super-admin/subscriptions" element={guarded(<SuperAdminSubscriptions />, "subscription", ["super_admin"])} />
            <Route path="/super-admin/usage" element={guarded(<SuperAdminUsage />, "reports", ["super_admin"])} />
            <Route path="/super-admin/support" element={guarded(<SuperAdminSupport />, "support", ["super_admin"])} />
            <Route path="/super-admin/settings" element={guarded(<SuperAdminSettings />, "settings", ["super_admin"], "configure")} />
            <Route path="/owner/*" element={guarded(<PlaceholderPage />, "dashboard", ["owner", "admin"])} />
            <Route path="/reception/*" element={guarded(<PlaceholderPage />, "dashboard", ["receptionist"])} />
            <Route path="/doctor/*" element={guarded(<PlaceholderPage />, "appointments", ["doctor"])} />
            <Route path="/pharmacy/*" element={guarded(<PlaceholderPage />, "pharmacy", ["pharmacist"])} />
            <Route path="/super-admin/*" element={guarded(<PlaceholderPage />, "dashboard", ["super_admin"])} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
