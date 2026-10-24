import { Button, Input, Modal, Select } from "../../../components/ui";

export function WalkInPatientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Modal open={open} onClose={onClose} title="Add Walk-in Patient"><div className="grid gap-4 sm:grid-cols-2"><Input placeholder="Full name" /><Input placeholder="Phone" /><Input type="number" placeholder="Age" /><Select><option>female</option><option>male</option><option>other</option></Select><Input className="sm:col-span-2" placeholder="Reason for visit" /><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={onClose}>Create token</Button></div></Modal>;
}
