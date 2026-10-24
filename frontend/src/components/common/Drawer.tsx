import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Side panel for details (purchase lines, batches, movement history). Full width on phones. */
export function Drawer({ open, title, description, footer, onClose, children, width = "sm:max-w-xl" }: { open: boolean; title: string; description?: ReactNode; footer?: ReactNode; onClose: () => void; children?: ReactNode; width?: string }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    (focusable()[0] ?? panel)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panelRef} tabIndex={-1} className={`flex h-full w-full flex-col bg-white shadow-popover ${width}`}>
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4"><div className="min-w-0"><h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>{description && <div className="mt-1 text-sm text-slate-500">{description}</div>}</div><button className="tap-target shrink-0 rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close panel"><X className="mx-auto size-5" /></button></div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t bg-white px-5 py-4">{footer}</div>}
    </div>
  </div>;
}
