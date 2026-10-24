import type { ClinicDepartment, WhatsAppAvailability, WhatsAppBookingSettings, WhatsAppBookingStats, WhatsAppConversation, WhatsAppDoctor, WhatsAppMessage, WhatsAppTemplate } from "../../modules/whatsapp-booking/types";

export type WhatsAppDeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "received";
export type WhatsAppConsentStatus = "unknown" | "opted_in" | "opted_out" | "revoked";

export type WhatsAppConversationInput = {
  clinicId?: string;
  branchId?: string | null;
  patientId?: string | null;
  phone: string;
  status?: WhatsAppConversation["status"];
  source?: WhatsAppConversation["source"];
  currentStep?: string;
  linkedAppointmentId?: string | null;
  lastMessage?: string;
  metadata?: Record<string, unknown>;
};

export type WhatsAppMessageInput = {
  clinicId?: string;
  branchId?: string | null;
  conversationId?: string | null;
  patientId?: string | null;
  phone: string;
  direction?: "inbound" | "outbound";
  sender?: WhatsAppMessage["sender"];
  messageType?: "text" | "template" | "appointment" | "prescription" | "reminder" | "invoice" | "system";
  body: string;
  templateId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  deliveryStatus?: WhatsAppDeliveryStatus;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type WhatsAppTemplateInput = {
  clinicId?: string;
  branchId?: string | null;
  name: string;
  category: WhatsAppTemplate["category"] | "prescription" | "invoice" | "other";
  status?: WhatsAppTemplate["status"];
  previewText: string;
  variables?: string[];
  metadata?: Record<string, unknown>;
};

export type WhatsAppConsentInput = {
  clinicId?: string;
  branchId?: string | null;
  patientId?: string | null;
  phone: string;
  consentStatus: WhatsAppConsentStatus;
  consentSource?: "staff" | "patient" | "import" | "system";
  metadata?: Record<string, unknown>;
};

export type WhatsAppSendPlaceholderInput = {
  clinicId?: string;
  branchId?: string | null;
  conversationId?: string | null;
  patientId?: string | null;
  phone: string;
  body: string;
  relatedId?: string | null;
  metadata?: Record<string, unknown>;
};

export interface WhatsAppService {
  getConversations(clinicId?: string): Promise<WhatsAppConversation[]>;
  getConversationById(id: string): Promise<WhatsAppConversation | null>;
  createConversation(input: WhatsAppConversationInput): Promise<WhatsAppConversation>;
  updateConversation(id: string, input: Partial<WhatsAppConversationInput>): Promise<WhatsAppConversation>;
  deleteConversation(id: string): Promise<void>;
  transferConversationToReception(id: string): Promise<WhatsAppConversation>;
  getMessages(conversationId: string): Promise<WhatsAppMessage[]>;
  createMessage(input: WhatsAppMessageInput): Promise<WhatsAppMessage>;
  updateMessage(id: string, input: Partial<WhatsAppMessageInput>): Promise<WhatsAppMessage>;
  deleteMessage(id: string): Promise<void>;
  getTemplates(clinicId?: string): Promise<WhatsAppTemplate[]>;
  createTemplate(input: WhatsAppTemplateInput): Promise<WhatsAppTemplate>;
  updateTemplate(id: string, input: Partial<WhatsAppTemplateInput>): Promise<WhatsAppTemplate>;
  deleteTemplate(id: string): Promise<void>;
  getConsent(phone: string, clinicId?: string): Promise<WhatsAppConsentStatus>;
  upsertConsent(input: WhatsAppConsentInput): Promise<WhatsAppConsentStatus>;
  createDeliveryLog(input: { messageId?: string | null; conversationId?: string | null; clinicId?: string; branchId?: string | null; patientId?: string | null; phone?: string; deliveryStatus: WhatsAppDeliveryStatus; payload?: Record<string, unknown>; metadata?: Record<string, unknown> }): Promise<void>;
  saveWebhookEventPlaceholder(input: { clinicId?: string; branchId?: string | null; eventType?: string; providerEventId?: string | null; payload?: Record<string, unknown>; metadata?: Record<string, unknown> }): Promise<void>;
  /** Clinic-level WhatsApp configuration, persisted in clinics.settings->'whatsapp'. */
  getSettings(clinicId?: string): Promise<WhatsAppBookingSettings>;
  updateSettings(input: Partial<WhatsAppBookingSettings>, clinicId?: string): Promise<WhatsAppBookingSettings>;
  /** Live counters for the WhatsApp booking dashboard. */
  getStats(clinicId?: string): Promise<WhatsAppBookingStats>;
  /** Departments actually staffed at the clinic, derived from doctor profiles. */
  getDepartments(clinicId?: string): Promise<Array<{ id: ClinicDepartment; label: string }>>;
  getClinicDoctors(clinicId?: string): Promise<WhatsAppDoctor[]>;
  getDoctorAvailability(doctorId: string, days?: number): Promise<WhatsAppAvailability>;
  sendAppointmentPlaceholder(input: WhatsAppSendPlaceholderInput): Promise<WhatsAppMessage>;
  sendPrescriptionPlaceholder(input: WhatsAppSendPlaceholderInput): Promise<WhatsAppMessage>;
  sendReminderPlaceholder(input: WhatsAppSendPlaceholderInput): Promise<WhatsAppMessage>;
  sendInvoicePlaceholder(input: WhatsAppSendPlaceholderInput): Promise<WhatsAppMessage>;
}
