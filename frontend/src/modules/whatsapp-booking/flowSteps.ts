import type { WhatsAppFlowStep } from "./types";

/**
 * Static explanation of how the WhatsApp booking flow works. This is product
 * copy shown on the dashboard, not clinic data.
 */
export const bookingFlowSteps: WhatsAppFlowStep[] = [
  { id: "f1", title: "Patient sends Hi", description: "The patient starts from WhatsApp, a QR code, or the public booking link.", sampleMessage: "Hi" },
  { id: "f2", title: "Clinic mode decides the path", description: "Multi-speciality clinics ask for a department first. Single-speciality clinics show simple actions.", sampleMessage: "What type of care do you need?" },
  { id: "f3", title: "Doctor, date and slot", description: "Only doctors with published availability and open slots are offered.", sampleMessage: "Choose a doctor and an available time slot." },
  { id: "f4", title: "One question at a time", description: "Name, age, gender, problem and new/existing patient status are collected.", sampleMessage: "What problem are you facing?" },
  { id: "f5", title: "Summary before confirmation", description: "The patient confirms before the appointment reaches the clinic dashboards.", sampleMessage: "Please confirm this booking summary." },
  { id: "f6", title: "Clinic dashboards update", description: "Reception and the doctor queue receive the appointment with a token number.", sampleMessage: "Your appointment is confirmed." },
];
