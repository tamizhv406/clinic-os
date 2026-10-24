import type { ReactNode } from "react";
import { StatusBadge, type StatusTone } from "./StatusBadge";
export function Badge({ children, className = "", tone = "neutral" }: { children: ReactNode; className?: string; tone?: StatusTone }) { return <StatusBadge tone={tone} className={className}>{children}</StatusBadge>; }
