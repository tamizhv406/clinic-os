import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & { onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void; variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" | "lg" | "icon"; icon?: ReactNode; loading?: boolean; to?: string };
export function buttonClassName(variant: NonNullable<Props["variant"]> = "primary", size: NonNullable<Props["size"]> = "md", className = "") {
  const styles = { primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-card", secondary: "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50", outline: "border border-brand-200 bg-white text-brand-700 hover:bg-brand-50", ghost: "text-slate-600 hover:bg-slate-100", danger: "bg-danger-700 text-white hover:bg-danger-700/90" };
  const sizes = { sm: "min-h-8 px-3 text-xs", md: "min-h-10 px-4 text-sm", lg: "min-h-11 px-5 text-sm", icon: "size-10 p-0" };
  return `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${styles[variant]} ${sizes[size]} ${className}`;
}
export function Button({ variant = "primary", size = "md", icon, loading, className = "", children, disabled, to, onClick, ...props }: Props) {
  const classes = buttonClassName(variant, size, className);
  const content = <>{loading ? <Loader2 className="size-4 animate-spin" /> : icon}{size !== "icon" && children}</>;
  if (to) {
    if (disabled || loading) return <button className={classes} disabled aria-disabled="true" {...props}>{content}</button>;
    return <Link to={to} className={classes} onClick={onClick} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{content}</Link>;
  }
  return <button className={classes} disabled={disabled || loading} onClick={onClick} {...props}>{content}</button>;
}
