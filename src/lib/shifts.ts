import { z } from "zod";
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";

export const SHIFT_STATUSES = [
  { value: "disponibile", label: "Disponibile", className: "bg-info/10 text-info border-info/30", dot: "bg-info" },
  { value: "assente", label: "Assente", className: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive" },
  { value: "meglio_di_no", label: "Meglio di no", className: "bg-primary/10 text-primary border-primary/30", dot: "bg-primary" },
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
export type Collaborator = { id: string; first_name: string; last_name: string; active: boolean; realtime_topic: string };
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