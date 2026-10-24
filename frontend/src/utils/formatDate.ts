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
