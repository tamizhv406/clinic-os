import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({ title = "Something went wrong", description = "Please try again.", onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return <div className="card flex flex-col items-center px-6 py-12 text-center"><div className="rounded-lg bg-danger-50 p-3 text-danger-700"><AlertTriangle className="size-6" /></div><h3 className="mt-4 font-semibold text-slate-900">{title}</h3><p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>{onRetry && <Button className="mt-4" variant="secondary" onClick={onRetry}>Retry</Button>}</div>;
}
