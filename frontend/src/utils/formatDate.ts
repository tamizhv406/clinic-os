import { format } from "date-fns";
export const formatDate = (date: Date | string) => format(new Date(date), "dd MMM yyyy");

/** The clinics run on India Standard Time; "today" must follow it, not the browser or UTC. */
export const CLINIC_TIME_ZONE = "Asia/Kolkata";

/**
 * Calendar date (YYYY-MM-DD) in the clinic's time zone. Use this instead of
 * `new Date().toISOString().slice(0, 10)`, which is UTC and still shows
 * yesterday between 00:00 and 05:30 IST.
 */
export function localDateISO(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Adds whole days to a YYYY-MM-DD date without time-zone drift. */
export function addDaysISO(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Whole days from one YYYY-MM-DD date to another (negative when `to` is earlier). */
export function daysBetweenISO(from: string, to: string) {
  const toUtc = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** Start of the given IST calendar day as an ISO timestamp, for timestamptz range filters. */
export function istDayStartISO(isoDate: string) {
  return `${isoDate}T00:00:00+05:30`;
}

/**
 * Formats 24h time ("09:00:00" or "14:30") into consistent 12-hour AM/PM format ("09:00 AM", "02:30 PM").
 */
export function formatTime12(time: string | null | undefined): string {
  if (!time) return "";
  const match = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(time);
  const hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, "0")}:${minutes} ${ampm}`;
}
