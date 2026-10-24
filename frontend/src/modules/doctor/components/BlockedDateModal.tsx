import { useState } from "react";
import { Button, Input, Modal } from "../../../components/ui";

export function BlockedDateModal({ open, onClose, onSave, loading }: { open: boolean; onClose: () => void; onSave?: (input: { date: string; reason: string; emergencyLeave: boolean }) => void; loading?: boolean }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [emergencyLeave, setEmergencyLeave] = useState(false);

  return <Modal open={open} onClose={onClose} title="Block doctor date"><div className="space-y-3"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><Input placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={emergencyLeave} onChange={(event) => setEmergencyLeave(event.target.checked)} /> Emergency leave</label><Button loading={loading} onClick={() => onSave?.({ date, reason, emergencyLeave })}>Save block</Button></div></Modal>;
}
