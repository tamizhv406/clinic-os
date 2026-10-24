import { useEffect, useState } from "react";
import { Button, Card, Input, Select } from "../../../components/ui";
import type { WhatsAppBookingSettings, WhatsAppProvider } from "../types";

type ToggleKey = "enableBooking" | "allowExistingPatientLookup" | "requirePaymentBeforeConfirmation" | "autoCreateAppointment" | "sendReminderBeforeAppointment" | "followUpReminder" | "handoffOnStaff" | "handoffAfterFailedAttempts";

const flowToggles: Array<[ToggleKey, string]> = [
  ["enableBooking", "Enable WhatsApp booking"],
  ["allowExistingPatientLookup", "Allow existing patient lookup"],
  ["requirePaymentBeforeConfirmation", "Require payment before confirmation"],
  ["autoCreateAppointment", "Auto-create appointment after confirmation"],
  ["sendReminderBeforeAppointment", "Send reminder before appointment"],
];

const handoffToggles: Array<[ToggleKey, string]> = [
  ["followUpReminder", "Follow-up reminder"],
  ["handoffOnStaff", "Transfer if the patient types “staff”"],
  ["handoffAfterFailedAttempts", "Transfer after repeated failed attempts"],
];

const providers: Array<[WhatsAppProvider, string]> = [
  ["meta_cloud_api", "Meta Cloud API"],
  ["interakt", "Interakt"],
  ["aisensy", "AiSensy"],
  ["wati", "WATI"],
  ["gupshup", "Gupshup"],
  ["twilio", "Twilio"],
];

export function WhatsAppSettingsForm({ settings, saving = false, onSave }: { settings: WhatsAppBookingSettings; saving?: boolean; onSave?: (next: WhatsAppBookingSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);

  const set = <K extends keyof WhatsAppBookingSettings>(key: K, value: WhatsAppBookingSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); onSave?.(draft); }}>
    <Card className="p-4 md:p-5">
      <h2 className="font-semibold">WhatsApp Business Number</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Input value={draft.businessNumber} onChange={(event) => set("businessNumber", event.target.value)} placeholder="Business number" />
        <Input value={draft.displayName} onChange={(event) => set("displayName", event.target.value)} placeholder="Display name" />
        <Input value={draft.businessProfileStatus} onChange={(event) => set("businessProfileStatus", event.target.value)} placeholder="Business profile status" />
      </div>
    </Card>

    <Card className="p-4 md:p-5">
      <h2 className="font-semibold">Booking Flow Settings</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {flowToggles.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold">
          <input type="checkbox" checked={draft[key]} onChange={(event) => set(key, event.target.checked)} />{label}
        </label>)}
        <Select value={draft.clinicMode} onChange={(event) => set("clinicMode", event.target.value as WhatsAppBookingSettings["clinicMode"])} aria-label="Clinic mode">
          <option value="single_speciality">Single-speciality flow</option>
          <option value="multi_speciality">Multi-speciality flow (ask department first)</option>
        </Select>
      </div>
    </Card>

    <Card className="p-4 md:p-5">
      <h2 className="font-semibold">Reminder &amp; Handoff Settings</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Select value={draft.reminderTiming} onChange={(event) => set("reminderTiming", event.target.value)} aria-label="Reminder timing">
          <option>1 hour before</option>
          <option>2 hours before</option>
          <option>24 hours before</option>
        </Select>
        <Input value={draft.reminderTemplate} onChange={(event) => set("reminderTemplate", event.target.value)} placeholder="Reminder template name" />
        {handoffToggles.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold">
          <input type="checkbox" checked={draft[key]} onChange={(event) => set(key, event.target.checked)} />{label}
        </label>)}
        <Input value={draft.receptionContactDisplay} onChange={(event) => set("receptionContactDisplay", event.target.value)} placeholder="Reception contact shown to patients" />
      </div>
    </Card>

    <Card className="p-4 md:p-5">
      <h2 className="font-semibold">Provider Integration</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Select value={draft.provider} onChange={(event) => set("provider", event.target.value as WhatsAppProvider)} aria-label="Provider">
          {providers.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Select value={draft.apiStatus} onChange={(event) => set("apiStatus", event.target.value as WhatsAppBookingSettings["apiStatus"])} aria-label="API status">
          <option value="not_connected">Not connected</option>
          <option value="connected">Connected</option>
        </Select>
      </div>
      <p className="mt-4 rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-700">
        Use only the official WhatsApp Business API for patient health data. API credentials belong in server-side environment variables, never in this form.
      </p>
    </Card>

    <div className="flex gap-2">
      <Button type="submit" loading={saving} disabled={!dirty}>Save settings</Button>
      <Button type="button" variant="ghost" disabled={!dirty} onClick={() => setDraft(settings)}>Discard changes</Button>
    </div>
  </form>;
}
