export const chartTheme = {
  teal: "#087f8c",
  success: "#059669",
  warning: "#d97706",
  info: "#3b82f6",
  danger: "#e11d48",
  neutral: "#94a3b8",
  grid: "#e2e8f0",
  fill: "#ccfbf1",
};
export const chartStatusColors: Record<string, string> = {
  Completed: chartTheme.teal,
  Waiting: chartTheme.warning,
  Booked: chartTheme.info,
  Cancelled: chartTheme.danger,
  "No show": chartTheme.neutral,
};
