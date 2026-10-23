import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Tables } from "@/integrations/supabase/types";

export type Task = Tables<"company_tasks">;
export type CalendarEntry = Tables<"calendar_entries">;
export type Alternative = { starts_at: string; ends_at: string };
export const TASK_STATUS = { da_fare: "Aperta", in_corso: "Work in progress", completata: "Completata" };
export const PRIORITY = { bassa: "Bassa", normale: "Normale", alta: "Alta", urgente: "Urgente" };
export const ZONE = "Europe/Rome";
export const wallTime = (iso: string | null, zone = ZONE) => iso ? formatInTimeZone(iso, zone, "yyyy-MM-dd'T'HH:mm") : "";
export const toInstant = (wall: string, zone = ZONE) => wall ? fromZonedTime(wall, zone).toISOString() : null;
export const planningDate = (iso: string | null, zone = ZONE) => iso ? formatInTimeZone(iso, zone, "dd/MM/yyyy HH:mm") : "—";
export const isOverdue = (task: Pick<Task, "due_at" | "status" | "archived">, now = new Date()) => !task.archived && task.status !== "completata" && !!task.due_at && new Date(task.due_at) < now;
export function alternativesOf(entry: Pick<CalendarEntry, "alternatives">): Alternative[] {
  if (!Array.isArray(entry.alternatives)) return [];
  return entry.alternatives.flatMap(a => a && typeof a === "object" && !Array.isArray(a) && typeof a['starts_at'] === "string" && typeof a['ends_at'] === "string" ? [{ starts_at: a['starts_at'], ends_at: a['ends_at'] }] : []);
}
export function confirmAlternative(entry: Pick<CalendarEntry, "starts_at" | "ends_at" | "alternatives">, alternative: Alternative) {
  const dates = alternativesOf(entry);
  if (!dates.some(a => new Date(a.starts_at).getTime() === new Date(entry.starts_at).getTime() && new Date(a.ends_at).getTime() === new Date(entry.ends_at).getTime())) dates.push({ starts_at: entry.starts_at, ends_at: entry.ends_at });
  return { starts_at: alternative.starts_at, ends_at: alternative.ends_at, confirmed: true, alternatives: dates };
}
export const overlaps = (a: Pick<CalendarEntry, "starts_at" | "ends_at">, b: Pick<CalendarEntry, "starts_at" | "ends_at">) => new Date(a.starts_at) < new Date(b.ends_at) && new Date(b.starts_at) < new Date(a.ends_at);
export function upcomingEvents<T extends Pick<CalendarEntry, "archived" | "starts_at" | "ends_at">>(events: T[], now = new Date()): T[] {
  return events.filter(e => !e.archived && new Date(e.ends_at) >= now).sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}
export function taskStats(tasks: Task[], now = new Date()) {
  const active = tasks.filter(t => !t.archived);
  return { total: active.length, todo: active.filter(t => t.status === "da_fare").length, progress: active.filter(t => t.status === "in_corso").length, done: active.filter(t => t.status === "completata").length, mandatory: active.filter(t => t.mandatory && t.status !== "completata").length, overdue: active.filter(t => isOverdue(t, now)).length };
}

export const EVENT_COLORS = [
  { value: "blu", label: "Blu", dot: "bg-info", chip: "border-info bg-info/10 text-info" },
  { value: "arancione", label: "Arancione", dot: "bg-primary", chip: "border-primary bg-primary/10 text-primary" },
  { value: "verde", label: "Verde", dot: "bg-success", chip: "border-success bg-success/10 text-success" },
  { value: "rosso", label: "Rosso", dot: "bg-destructive", chip: "border-destructive bg-destructive/10 text-destructive" },
  { value: "grigio", label: "Grigio", dot: "bg-muted-foreground", chip: "border-muted-foreground bg-muted text-foreground" },
] as const;
export function eventColor(value: string | null | undefined) { return EVENT_COLORS.find(c => c.value === value) ?? EVENT_COLORS[0]; }
