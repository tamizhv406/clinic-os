import type { WhatsAppFlowStep } from "../types";
import { FlowStepCard } from "./FlowStepCard";

export function BookingFlowTimeline({ steps }: { steps: WhatsAppFlowStep[] }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{steps.map((step, index) => <FlowStepCard key={step.id} step={step} index={index} />)}</div>;
}
