import { z } from "zod";
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
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
export function criticalDays<P extends Pick<Collaborator, "id" | "active">>(days: string[], people: P[], assignments: ShiftAssignment[], entries: Pick<ShiftEntry, "collaborator_id" | "day">[], minimum = MIN_STAFF_PER_DAY) {
  const active = people.filter(p => p.active);
  const filled = new Set(entries.map(e => `${e.collaborator_id}:${e.day}`));
  return days.map(day => ({
    day,
    assigned: assignments.filter(a => a.day === day).length,
    missing: active.filter(p => !filled.has(`${p.id}:${day}`)),
  })).filter(d => d.assigned < minimum);
}
export type ShiftView = "giorno" | "settimana" | "mese";
export const SHIFT_VIEWS: { value: ShiftView; label: string }[] = [
  { value: "giorno", label: "Giorno" }, { value: "settimana", label: "Settimana" }, { value: "mese", label: "Mese" },
];
function noon(day: string) { return new Date(`${day}T12:00:00`); }
export function periodDays(view: ShiftView, anchor: string) {
  if (view === "giorno") return [anchor];
  if (view === "settimana") {
    const monday = startOfWeek(noon(anchor), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"));
  }
  const month = anchor.slice(0, 7);
  return monthDays(month).filter(d => d.startsWith(month));
}
export function movePeriod(view: ShiftView, anchor: string, step: number) {
  if (view === "mese") return format(addMonths(startOfMonth(noon(anchor)), step), "yyyy-MM-dd");
  return shiftDayOffset(anchor, view === "settimana" ? step * 7 : step);
}
export function periodLabel(view: ShiftView, anchor: string) {
  if (view === "giorno") return format(noon(anchor), "EEEE d MMMM yyyy", { locale: it });
  if (view === "mese") return format(noon(anchor), "MMMM yyyy", { locale: it });
  const days = periodDays(view, anchor);
  const first = noon(days[0] ?? anchor); const last = noon(days.at(-1) ?? anchor);
  const sameMonth = format(first, "yyyy-MM") === format(last, "yyyy-MM");
  return `${format(first, sameMonth ? "d" : "d MMMM", { locale: it })} – ${format(last, "d MMMM yyyy", { locale: it })}`;
}
type ExportCell = string | number;
type NamedPerson = Pick<Collaborator, "id" | "first_name" | "last_name">;
function byName(a: NamedPerson | undefined, b: NamedPerson | undefined) {
  return (a?.last_name ?? "").localeCompare(b?.last_name ?? "", "it") || (a?.first_name ?? "").localeCompare(b?.first_name ?? "", "it");
}
export function shiftsExportRows(people: NamedPerson[], assignments: ShiftAssignment[]): ExportCell[][] {
  const names = new Map(people.map(p => [p.id, p]));
  const sorted = [...assignments].sort((a, b) => a.day.localeCompare(b.day) || a.starts_at.localeCompare(b.starts_at) || byName(names.get(a.collaborator_id), names.get(b.collaborator_id)));
  return [
    ["Data", "Cognome", "Nome", "Inizio", "Fine", "Finisce il giorno dopo", "Ore", "Stato", "Note"],
    ...sorted.map(a => {
      const p = names.get(a.collaborator_id);
      return [a.day, p?.last_name ?? "", p?.first_name ?? "", a.starts_at.slice(0, 5), a.ends_at.slice(0, 5), a.ends_next_day ? "Sì" : "No", assignmentMinutes(a) / 60, ASSIGNMENT_STATUSES.find(s => s.value === a.status)?.label ?? a.status, a.note];
    }),
  ];
}
export function hoursExportRows(people: (NamedPerson & Pick<Collaborator, "active">)[], assignments: ShiftAssignment[], first: string, last: string): ExportCell[][] {
  const totals = hoursByCollaborator(assignments, first, last);
  const listed = people.filter(p => p.active || totals.has(p.id)).sort(byName);
  const sum = [...totals.values()].reduce((acc, t) => ({ shifts: acc.shifts + t.shifts, minutes: acc.minutes + t.minutes }), { shifts: 0, minutes: 0 });
  return [
    ["Cognome", "Nome", "Turni", "Ore"],
    ...listed.map(p => { const t = totals.get(p.id); return [p.last_name, p.first_name, String(t?.shifts ?? 0), (t?.minutes ?? 0) / 60]; }),
    ["Totale", "", String(sum.shifts), sum.minutes / 60],
  ];
}
export const HISTORY_ACTIONS: Record<string, string> = { creazione: "Creazione", modifica: "Modifica", pubblicazione: "Pubblicazione", eliminazione: "Eliminazione" };
export const HISTORY_SOURCES: Record<string, string> = { app: "App", foglio: "Foglio Google", link: "Link personale" };
type HistoryData = Record<string, unknown> | null;
function text(value: unknown) { return typeof value === "string" ? value : ""; }
const HISTORY_FIELDS: Record<string, { label: string; value: (d: Record<string, unknown>) => string }[]> = {
  turno: [
    { label: "Orario", value: d => assignmentTime({ starts_at: text(d["starts_at"]), ends_at: text(d["ends_at"]), ends_next_day: d["ends_next_day"] === true }) },
    { label: "Stato", value: d => ASSIGNMENT_STATUSES.find(s => s.value === d["status"])?.label ?? text(d["status"]) },
    { label: "Note", value: d => text(d["note"]) },
  ],
  disponibilita: [
    { label: "Disponibilità", value: d => SHIFT_STATUSES.find(s => s.value === d["status"])?.label ?? text(d["status"]) },
    { label: "Nota", value: d => text(d["note"]) },
  ],
};
export function shiftHistoryChanges(entityType: string, before: HistoryData, after: HistoryData) {
  return (HISTORY_FIELDS[entityType] ?? []).flatMap(field => {
    const from = before ? field.value(before) : null;
    const to = after ? field.value(after) : null;
    if (from === to || (!from && !to)) return [];
    return [before ? `${field.label}: ${from || "—"} → ${to || "—"}` : `${field.label}: ${to}`];
  });
}
export function monthWeeks(month: string) {
  const days = monthDays(month);
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}
export type PlanSlot = { on: boolean; starts_at: string; ends_at: string; ends_next_day: boolean; note: string };
export const planKey = (collaboratorId: string, day: string) => `${collaboratorId}:${day}`;
export function planSlots(assignments: ShiftAssignment[], days: string[]) {
  const slots: Record<string, PlanSlot> = {};
  for (const a of assignments) if (days.includes(a.day)) slots[planKey(a.collaborator_id, a.day)] = { on: true, starts_at: a.starts_at.slice(0, 5), ends_at: a.ends_at.slice(0, 5), ends_next_day: a.ends_next_day, note: a.note };
  return slots;
}
const AVAILABILITY_ORDER = ["disponibile", "meglio_di_no", "", "assente"];
export function planningOrder<P extends Pick<Collaborator, "id" | "first_name" | "last_name">>(people: P[], entries: Pick<ShiftEntry, "collaborator_id" | "day" | "status" | "note">[], day: string) {
  const byPerson = new Map(entries.filter(e => e.day === day).map(e => [e.collaborator_id, e]));
  return people.map(p => ({ person: p, entry: byPerson.get(p.id) }))
    .sort((a, b) => AVAILABILITY_ORDER.indexOf(a.entry?.status ?? "") - AVAILABILITY_ORDER.indexOf(b.entry?.status ?? "") || a.person.last_name.localeCompare(b.person.last_name, "it") || a.person.first_name.localeCompare(b.person.first_name, "it"));
}
// Only changed rows are sent, so untouched published shifts never turn into "Modificato".
export function planChanges(existing: ShiftAssignment[], slots: Record<string, PlanSlot>, names: Map<string, string> = new Map()) {
  const current = new Map(existing.map(a => [planKey(a.collaborator_id, a.day), a]));
  const save: z.infer<typeof assignmentInputSchema>[] = []; const remove: { collaborator_id: string; day: string }[] = []; const errors: string[] = [];
  for (const [key, slot] of Object.entries(slots)) {
    const [collaborator_id = "", day = ""] = key.split(":");
    const before = current.get(key);
    if (!slot.on) { if (before) remove.push({ collaborator_id, day }); continue; }
    const parsed = assignmentInputSchema.safeParse({ collaborator_id, day, starts_at: slot.starts_at, ends_at: slot.ends_at, ends_next_day: slot.ends_next_day, note: slot.note });
    if (!parsed.success) { errors.push(`${names.get(collaborator_id) ?? "Collaboratore"}, ${format(noon(day), "EEEE d", { locale: it })}: ${slot.starts_at && slot.ends_at ? parsed.error.issues[0]?.message ?? "orario non valido" : "inserisci inizio e fine"}`); continue; }
    const p = parsed.data;
    if (before && before.starts_at.slice(0, 5) === p.starts_at && before.ends_at.slice(0, 5) === p.ends_at && before.ends_next_day === p.ends_next_day && before.note === p.note) continue;
    save.push(p);
  }
  return { save, remove, errors };
}
