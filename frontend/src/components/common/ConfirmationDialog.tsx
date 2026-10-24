import { Button } from "./Button";
import { Modal } from "./Modal";

export function ConfirmationDialog({ open, title, description, confirmLabel = "Confirm", danger, onCancel, onConfirm }: { open: boolean; title: string; description: string; confirmLabel?: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Modal open={open} title={title} description={description} onClose={onCancel} footer={<><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button></>} />;
}
