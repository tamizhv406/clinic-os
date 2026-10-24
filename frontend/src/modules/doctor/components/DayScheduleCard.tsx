import { useEffect, useState } from "react";
import { Button, Card, Input } from "../../../components/ui";
import type { DaySchedule } from "../types";

export type DaySaveInput = { enabled: boolean; startTime: string; endTime: string; breakStart: string; breakEnd: string };

export function DayScheduleCard({ day, dayIndex, saving, onSave }: { day: DaySchedule; dayIndex: number; saving: boolean; onSave: (dayIndex: number, input: DaySaveInput) => void }) {
  const [breakStartDefault, breakEndDefault] = day.breakTime ? day.breakTime.split("-") : ["", ""];
  const [enabled, setEnabled] = useState(day.enabled);
  const [startTime, setStartTime] = useState(day.startTime);
  const [endTime, setEndTime] = useState(day.endTime);
  const [breakStart, setBreakStart] = useState(breakStartDefault ?? "");
  const [breakEnd, setBreakEnd] = useState(breakEndDefault ?? "");

  useEffect(() => {
    const [nextBreakStart, nextBreakEnd] = day.breakTime ? day.breakTime.split("-") : ["", ""];
    setEnabled(day.enabled);
    setStartTime(day.startTime);
    setEndTime(day.endTime);
    setBreakStart(nextBreakStart ?? "");
    setBreakEnd(nextBreakEnd ?? "");
  }, [day]);

  const dirty = enabled !== day.enabled || startTime !== day.startTime || endTime !== day.endTime || breakStart !== breakStartDefault || breakEnd !== breakEndDefault;

  return <Card className="p-4">
    <div className="mb-3 flex items-center justify-between">
      <div><h3 className="font-semibold">{day.day}</h3><p className="text-xs text-slate-500">{enabled ? "Working day" : "Not available"}</p></div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled
      </label>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Input label="Start" type="time" value={startTime} disabled={!enabled} onChange={(event) => setStartTime(event.target.value)} />
      <Input label="End" type="time" value={endTime} disabled={!enabled} onChange={(event) => setEndTime(event.target.value)} />
      <Input label="Break start" type="time" value={breakStart} disabled={!enabled} onChange={(event) => setBreakStart(event.target.value)} />
      <Input label="Break end" type="time" value={breakEnd} disabled={!enabled} onChange={(event) => setBreakEnd(event.target.value)} />
    </div>
    <div className="mt-3 flex items-center justify-between">
      <p className="text-xs text-slate-500">{day.slotDurationMinutes} min slots &middot; max {day.maxAppointmentsPerSlot} per slot (set in doctor profile)</p>
      <Button size="sm" loading={saving} disabled={!dirty} onClick={() => onSave(dayIndex, { enabled, startTime, endTime, breakStart, breakEnd })}>Save</Button>
    </div>
  </Card>;
}
