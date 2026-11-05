import { z } from "zod";
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

export const SHIFT_STATUSES = [
  { value: "disponibile", label: "Disponibile", className: "bg-info/10 text-info border-info/30", dot: "bg-info" },
  { value: "assente", label: "Non disponibile", className: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive" },
  { value: "meglio_di_no", label: "Solo in caso di necessità", className: "bg-primary/10 text-primary border-primary/30", dot: "bg-primary" },
] as const;
export const shiftDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= "2020-01-01" && value <= "2100-12-31";
}, "Data non valida");
export const shiftEntrySchema = z.object({ day: shiftDaySchema, status: z.enum(["disponibile", "assente", "meglio_di_no"]).nullable(), note: z.string().trim().max(1000) });
export const shiftMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const shiftTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export type ShiftStatus = typeof SHIFT_STATUSES[number]["value"];
export type ShiftEntry = { id: string; collaborator_id: string; day: string; status: string; note: string; updated_at: string };
export type Collaborator = { id: string; first_name: string; last_name: string; active: boolean; realtime_topic: string; staff_role: string; contact_email: string; staff_notes: string };
export const ASSIGNMENT_STATUSES = [
  { value: "bozza", label: "Bozza", className: "border-dashed bg-muted text-muted-foreground border-muted-foreground/40" },
  { value: "pubblicato", label: "Pubblicato", className: "bg-success/10 text-success border-success/30" },
  { value: "modificato", label: "Modificato", className: "bg-warning/10 text-warning border-warning/40" },
] as const;
export const assignmentInputSchema = z.object({
  collaborator_id: z.string().uuid(), day: shiftDaySchema,
  starts_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  ends_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  ends_next_day: z.boolean(), note: z.string().trim().max(1000),
}).refine(d => d.ends_next_day || d.ends_at > d.starts_at, "La fine deve essere dopo l’inizio; seleziona il giorno successivo per i turni notturni");
export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number]["value"];
export type ShiftAssignment = z.infer<typeof assignmentInputSchema> & { id: string; updated_at: string; status: AssignmentStatus; published_at: string | null };
export function toAssignmentStatus(value: string): AssignmentStatus {
  return ASSIGNMENT_STATUSES.find(s => s.value === value)?.value ?? "bozza";
}
export function pendingPublication(assignments: Pick<ShiftAssignment, "status">[]) {
  return assignments.filter(a => a.status !== "pubblicato").length;
}
export function assignmentTime(entry: Pick<ShiftAssignment, "starts_at" | "ends_at" | "ends_next_day">) {
  return `${entry.starts_at.slice(0, 5)}–${entry.ends_at.slice(0, 5)}${entry.ends_next_day ? " (+1 giorno)" : ""}`;
}
export function monthDays(month: string) {
  const date = new Date(`${month}-01T12:00:00`);
  const first = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const last = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(format(d, "yyyy-MM-dd"));
  return days;
}
export function monthBounds(month: string) {
  const days = monthDays(month);
  return { first: days[0] ?? `${month}-01`, last: days.at(-1) ?? `${month}-28` };
}
const SHOP_ZONE = "Europe/Rome";
export const MIN_STAFF_PER_DAY = 3;
function shiftDayOffset(day: string, offset: number) {
  return format(addDays(new Date(`${day}T12:00:00`), offset), "yyyy-MM-dd");
}
// Real elapsed minutes in Rome time, so DST nights count one hour more or less.
export function assignmentMinutes(entry: Pick<ShiftAssignment, "day" | "starts_at" | "ends_at" | "ends_next_day">) {
  const start = fromZonedTime(`${entry.day}T${entry.starts_at.slice(0, 5)}:00`, SHOP_ZONE);
  const end = fromZonedTime(`${entry.ends_next_day ? shiftDayOffset(entry.day, 1) : entry.day}T${entry.ends_at.slice(0, 5)}:00`, SHOP_ZONE);
  return Math.round((end.getTime() - start.getTime()) / 60000);
}
export function formatHours(minutes: number) {
  return (minutes / 60).toLocaleString("it-IT", { maximumFractionDigits: 2 });
}
export function hoursByCollaborator(assignments: ShiftAssignment[], first: string, last: string) {
  const totals = new Map<string, { shifts: number; minutes: number }>();
  for (const entry of assignments) {
    if (entry.day < first || entry.day > last) continue;
    const total = totals.get(entry.collaborator_id) ?? { shifts: 0, minutes: 0 };
    totals.set(entry.collaborator_id, { shifts: total.shifts + 1, minutes: total.minutes + assignmentMinutes(entry) });
  }
  return totals;
}
// Availability for a Monday–Sunday week closes when the Friday before it ends.
export function availabilityDeadline(day: string) {
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return fromZonedTime(`${shiftDayOffset(day, -weekday - 2)}T00:00:00`, SHOP_ZONE);
}
export function isAvailabilityLocked(day: string, now = new Date()) {
  return now >= availabilityDeadline(day);
}
export function criticalDays(days: string[], people: Pick<Collaborator, "id" | "active">[], assignments: ShiftAssignment[], entries: Pick<ShiftEntry, "collaborator_id" | "day">[], minimum = MIN_STAFF_PER_DAY) {
  const active = people.filter(p => p.active);
  const filled = new Set(entries.map(e => `${e.collaborator_id}:${e.day}`));
  return days.map(day => ({
    day,
    assigned: assignments.filter(a => a.day === day).length,
    missing: active.filter(p => !filled.has(`${p.id}:${day}`)),
  })).filter(d => d.assigned < minimum);
}
