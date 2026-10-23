import type { CalendarEntry } from "./planning";
import { matchesText } from "./search";
import { wallTime } from "./planning";

export const emptyEventFilters = { q: "", from: "", to: "", hourFrom: "", hourTo: "", color: "" };
export type EventFilters = typeof emptyEventFilters;
export function filterUpcomingEvents<T extends Pick<CalendarEntry, "title" | "starts_at" | "color">>(events: T[], filters: EventFilters): T[] {
  return events.filter(event => {
    const local = wallTime(event.starts_at), date = local.slice(0, 10), time = local.slice(11, 16);
    const hourMatch = filters.hourFrom && filters.hourTo && filters.hourFrom > filters.hourTo
      ? time >= filters.hourFrom || time <= filters.hourTo
      : (!filters.hourFrom || time >= filters.hourFrom) && (!filters.hourTo || time <= filters.hourTo);
    return matchesText(event.title, filters.q) && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to) && hourMatch && (!filters.color || event.color === filters.color);
  });
}
export function eventReminders(events: CalendarEntry[], operator: string, now = new Date()) {
  return events.flatMap(event => {
    if (event.archived || event.reminder_minutes == null || event.reminder_minutes < 0 || !operator.trim()) return [];
    if (event.responsible_names.length && !event.responsible_names.some(name => matchesText(name, operator) && matchesText(operator, name))) return [];
    const due = new Date(event.starts_at).getTime() - event.reminder_minutes * 60_000;
    if (now.getTime() < due || now.getTime() > new Date(event.ends_at).getTime()) return [];
    return [{ event, due, key: `${event.id}:${event.starts_at}:${event.reminder_minutes}:${event.reminder_text}` }];
  }).sort((a, b) => a.due - b.due);
}