import { eventColor } from "@/lib/planning";
import { cn } from "@/lib/utils";

export function EventDot({ color, recurring = false, className }: { color: string | null; recurring?: boolean; className?: string }) {
  const assigned = eventColor(color);
  const label = `${assigned.label}${recurring ? " · Evento ricorrente" : ""}`;
  return <span role="img" aria-label={label} title={label} className={cn("inline-block size-3 shrink-0 rounded-full", assigned.dot, recurring && "event-dot-recurring", className)}/>;
}