import { Button, Modal } from "../../../components/ui";

export function ReminderConsentModal({ open, onClose, onEnable }: { open: boolean; onClose: () => void; onEnable: () => void }) {
  return <Modal open={open} onClose={onClose} title="Would the patient like WhatsApp medicine reminders?"><div className="space-y-3"><p className="rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-700">Confirm the patient has agreed before enabling reminders.</p><div className="flex flex-wrap gap-2"><Button onClick={onEnable}>Enable reminders</Button><Button variant="secondary" onClick={onClose}>Not now</Button></div></div></Modal>;
}
