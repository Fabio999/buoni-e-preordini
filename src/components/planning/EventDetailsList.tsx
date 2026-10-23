import { EVENT_DETAIL_FIELDS, parseEventDescription, type EventDetails } from "@/lib/event-details";
import { cn } from "@/lib/utils";

export function EventDetailsList({ description, details, compact = false }: { description?: string | null; details?: EventDetails; compact?: boolean }) {
  const values = details ?? parseEventDescription(description).details;
  return <span className={cn("grid min-w-0 gap-1 text-sm font-normal", compact ? "mt-2 text-xs" : "sm:grid-cols-2 sm:gap-x-6")}>
    {EVENT_DETAIL_FIELDS.map(field => <span key={field.key} className="min-w-0 whitespace-normal break-words leading-relaxed"><span aria-hidden="true">{field.emoji}</span> <span className="font-medium">{field.label}:</span> {values[field.key].trim() || "Da definire"}</span>)}
  </span>;
}