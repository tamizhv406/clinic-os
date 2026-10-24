import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({ open, title, description, footer, onClose, children }: { open: boolean; title: string; description?: string; footer?: ReactNode; onClose: () => void; children?: ReactNode }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    (focusable()[0] ?? dialog)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <div ref={dialogRef} tabIndex={-1} className="card modal-enter flex max-h-[92dvh] w-full flex-col rounded-b-none p-0 shadow-popover sm:max-w-lg sm:rounded-card"><div className="flex items-start justify-between gap-4 border-b px-5 py-4"><div><h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div><button className="tap-target rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close dialog"><X className="mx-auto size-5" /></button></div><div className="overflow-y-auto px-5 py-4">{children}</div>{footer && <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white px-5 py-4">{footer}</div>}</div></div>;
}


