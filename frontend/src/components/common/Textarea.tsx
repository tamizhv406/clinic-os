import type { TextareaHTMLAttributes } from "react";
type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; helperText?: string; error?: string; requiredMark?: boolean };
export function Textarea({ label, helperText, error, requiredMark, className = "", id, ...props }: Props) {
  const textareaId = id ?? (label ? label.toLowerCase().replace(/\W+/g, "-") : undefined);
  const textarea = <textarea id={textareaId} aria-invalid={Boolean(error)} className={`min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition hover:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500 ${error ? "border-danger-200 focus:border-danger-700 focus:ring-2 focus:ring-danger-700/15" : "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"} ${className}`} {...props} />;
  if (!label && !helperText && !error) return textarea;
  return <label className="block">{label && <span className="field-label">{label}{requiredMark && <span className="text-danger-700"> *</span>}</span>}{textarea}{helperText && !error && <p className="helper-text mt-1.5">{helperText}</p>}{error && <p className="field-error">{error}</p>}</label>;
}

