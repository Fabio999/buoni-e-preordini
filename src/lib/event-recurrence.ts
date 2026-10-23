import { addDays, addMonths, format, parseISO } from "date-fns";
import { toInstant } from "./planning";
import { normalizeText } from "./search";

export const RECURRENCE = { daily: "Ogni giorno", weekly: "Ogni settimana", fortnightly: "Ogni 2 settimane", monthly: "Ogni mese" };
export type Frequency = keyof typeof RECURRENCE;
export function occurrenceDates(start: string, end: string, zone: string, frequency: string, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 52) throw new Error("Scegli da 1 a 52 appuntamenti");
  if (frequency && !(frequency in RECURRENCE)) throw new Error("Ripetizione non valida");
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