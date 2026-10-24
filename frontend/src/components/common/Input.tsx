import type { InputHTMLAttributes } from "react";
type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; helperText?: string; error?: string; requiredMark?: boolean };
export function Input({ label, helperText, error, requiredMark, className = "", id, ...props }: Props) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\W+/g, "-") : undefined);
  const input = <input id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined} className={`min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition hover:border-slate-400 disabled:bg-slate-100 disabled:text-slate-500 ${error ? "border-danger-200 focus:border-danger-700 focus:ring-2 focus:ring-danger-700/15" : "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"} ${className}`} {...props} />;
  if (!label && !helperText && !error) return input;
  return <label className="block">{label && <span className="field-label">{label}{requiredMark && <span className="text-danger-700"> *</span>}</span>}{input}{helperText && !error && <p id={`${inputId}-helper`} className="helper-text mt-1.5">{helperText}</p>}{error && <p id={`${inputId}-error`} className="field-error">{error}</p>}</label>;
}

