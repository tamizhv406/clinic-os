import { Button, Card } from "../../../components/ui";
import type { ClinicMode } from "../types";

export function ClinicTypeSelector({ value, onChange }: { value: ClinicMode; onChange: (mode: ClinicMode) => void }) {
  return <Card className="p-4"><p className="font-semibold">Clinic mode</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{(["multi_speciality", "single_speciality"] as ClinicMode[]).map((mode) => <Button key={mode} type="button" variant={value === mode ? "primary" : "secondary"} onClick={() => onChange(mode)}>{mode === "multi_speciality" ? "Multi-speciality" : "Single-speciality"}</Button>)}</div></Card>;
}
