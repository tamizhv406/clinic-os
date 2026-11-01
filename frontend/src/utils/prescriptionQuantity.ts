/**
 * Works out how many units a prescription line needs, so the pharmacy dispenses the
 * whole course instead of defaulting to one.
 *
 *   dose "1 tablet" x frequency "1-0-1" (2 doses a day) x duration "3 days"  ->  "6"
 *   dose "2 tablets" x "1-1-1" x "1 week"                                    ->  "42"
 *
 * Returns "" when it cannot tell (free-text frequency such as "SOS" or "as needed");
 * the pharmacist then enters the quantity at the counter.
 */
export function estimatePrescribedQuantity(dosage: string, frequency: string, duration: string): string {
  const perDose = Number(dosage.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 1);
  const parts = frequency.split(/[-–]/).map((part) => Number(part.trim()));
  if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return "";
  const dosesPerDay = parts.reduce((sum, part) => sum + part, 0);

  const match = duration.toLowerCase().match(/(\d+)\s*(day|week|month)?/);
  if (!match) return "";
  const unit = match[2] ?? "day";
  const days = Number(match[1]) * (unit === "week" ? 7 : unit === "month" ? 30 : 1);

  const total = Math.ceil(perDose * dosesPerDay * days);
  return total > 0 && total <= 100000 ? String(total) : "";
}
