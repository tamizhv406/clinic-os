import type { DoctorAvailability } from "../types";
import { DayScheduleCard, type DaySaveInput } from "./DayScheduleCard";

export function WeeklyAvailabilityEditor({ availability, savingDay, onSaveDay }: { availability: DoctorAvailability; savingDay: number | null; onSaveDay: (dayIndex: number, input: DaySaveInput) => void }) {
  return <div className="grid gap-4 lg:grid-cols-2">{availability.weekly.map((day, index) => <DayScheduleCard key={day.day} day={day} dayIndex={index} saving={savingDay === index} onSave={onSaveDay} />)}</div>;
}
