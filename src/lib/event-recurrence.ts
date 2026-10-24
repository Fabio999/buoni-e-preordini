import { addDays, addMonths, format, parseISO } from "date-fns";
import { toInstant } from "./planning";
import { normalizeText } from "./search";
import type { CalendarEntry } from "./planning";

export function recurrenceTargets<T extends Pick<CalendarEntry, "id" | "recurrence_series" | "starts_at" | "archived">>(events: T[], initial: T, following: boolean) {
  if (!following || !initial.recurrence_series) return [initial];
  return events.filter(event => event.recurrence_series === initial.recurrence_series && event.starts_at >= initial.starts_at && !event.archived).sort((a,b) => a.starts_at.localeCompare(b.starts_at));
}

export const RECURRENCE = { daily: "Ogni giorno", weekly: "Ogni settimana", fortnightly: "Ogni 2 settimane", monthly: "Ogni mese" };
export function recurrenceColorUpdates<T extends Pick<CalendarEntry, "id" | "recurrence_series" | "starts_at" | "archived" | "color">>(events: T[], initial: T, color: string) {
  if (!initial.recurrence_series || initial.color === color) return [];
  return recurrenceTargets(events, initial, true).map(event => ({ ...event, color }));
}
export type Frequency = keyof typeof RECURRENCE;
export const WEEKDAYS = [
  { value: 1, label: "Lunedì" }, { value: 2, label: "Martedì" },
  { value: 3, label: "Mercoledì" }, { value: 4, label: "Giovedì" },
  { value: 5, label: "Venerdì" }, { value: 6, label: "Sabato" },
  { value: 0, label: "Domenica" },
];
export function alignWeekday(start: string, end: string, weekday: number) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Scegli un giorno della settimana");
  const date = parseISO(start);
  const days = (weekday - date.getDay() + 7) % 7;
  return { start: format(addDays(date, days), "yyyy-MM-dd'T'HH:mm"), end: format(addDays(parseISO(end), days), "yyyy-MM-dd'T'HH:mm") };
}
export function occurrenceDates(start: string, end: string, zone: string, frequency: string, count: number, weekday?: number) {
  if (!Number.isInteger(count) || count < 1 || count > 52) throw new Error("Scegli da 1 a 52 appuntamenti");
  if (frequency && !(frequency in RECURRENCE)) throw new Error("Ripetizione non valida");
  if (weekday !== undefined && (frequency === "weekly" || frequency === "fortnightly")) {
    const aligned = alignWeekday(start, end, weekday);
    start = aligned.start; end = aligned.end;
  }
  const shift = (wall: string, index: number) => {
    const date = parseISO(wall);
    const next = frequency === "monthly" ? addMonths(date, index) : addDays(date, index * (frequency === "daily" ? 1 : frequency === "fortnightly" ? 14 : 7));
    const instant = toInstant(format(next, "yyyy-MM-dd'T'HH:mm"), zone);
    if (!instant) throw new Error("Completa le date dell'evento");
    return instant;
  };
  return Array.from({ length: frequency ? count : 1 }, (_, index) => {
    const starts_at = shift(start, index), ends_at = shift(end, index);
    if (new Date(ends_at) <= new Date(starts_at)) throw new Error("La fine deve essere successiva all’inizio");
    return { starts_at, ends_at };
  });
}
export function mergeGames(...lists: string[][]) {
  const games = new Map<string, string>();
  for (const game of lists.flat()) { const value = game.trim(); if (value && !games.has(normalizeText(value))) games.set(normalizeText(value), value); }
  return [...games.values()].sort((a, b) => a.localeCompare(b, "it"));
}
export const gamesKey = (userId: string) => `mf-event-games:${userId}`;
export function readGames(userId: string): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(gamesKey(userId)) ?? "[]"); return Array.isArray(value) ? mergeGames(value.filter((v): v is string => typeof v === "string")) : []; } catch { return []; }
}
export function rememberGame(userId: string, game: string) {
  const games = mergeGames(readGames(userId), [game]);
  try { localStorage.setItem(gamesKey(userId), JSON.stringify(games)); } catch { /* Event still stores its game. */ }
  return games;
}