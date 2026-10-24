import type { StatusTone } from "../components/common/StatusBadge";
export const chartPalette = { teal: "#087f8c", success: "#059669", warning: "#d97706", info: "#3b82f6", danger: "#e11d48", neutral: "#94a3b8", grid: "#e2e8f0", fill: "#ccfbf1" } as const;
export const chartStatusColors: Record<string, string> = { Completed: chartPalette.teal, Waiting: chartPalette.warning, Booked: chartPalette.info, Cancelled: chartPalette.danger, "No show": chartPalette.neutral };
export const statusColors: Record<string, StatusTone> = {
  booked: "info", arrived: "brand", waiting: "warning", in_consultation: "info", completed: "success", cancelled: "danger", no_show: "neutral", paid: "success", pending: "warning", partial: "info", refunded: "neutral", queued: "neutral", sent: "info", delivered: "success", read: "brand", failed: "danger", active: "success", paused: "warning", suspended: "danger", trial: "warning", in_stock: "success", low_stock: "warning", out_of_stock: "danger", expiring_soon: "warning", expired: "danger", overdue: "danger", due_today: "warning", processed: "success", rejected: "danger", approved: "success", draft: "neutral", disabled: "neutral", needs_api_approval: "warning", VIP: "warning", "Senior Citizen": "neutral", "New Patient": "info", appointment_confirmed: "success", in_progress: "info", waiting_for_patient: "warning", transferred_to_reception: "brand"
};
export const toneForStatus = (status: string): StatusTone => statusColors[status] ?? (status.includes("failed") ? "danger" : status.includes("waiting") || status.includes("approval") ? "warning" : "neutral");

