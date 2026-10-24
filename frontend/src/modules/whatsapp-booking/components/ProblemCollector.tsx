import { Card } from "../../../components/ui";

export function ProblemCollector({ problem }: { problem: string }) {
  return <Card className="p-4"><p className="font-semibold">Main problem</p><p className="mt-2 text-sm text-slate-600">{problem}</p></Card>;
}
