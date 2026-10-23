import { describe, expect, it } from "vitest";
import { occurrenceDates, mergeGames, rememberGame, readGames, gamesKey } from "../lib/event-recurrence";
import { wallTime } from "../lib/planning";
describe("Ricorrenze evento", () => {
  it("mantiene le 20 italiane passando all'ora solare", () => {
    const rows = occurrenceDates("2026-10-23T20:00", "2026-10-24T00:30", "Europe/Rome", "weekly", 3);
    expect(rows.map(r => wallTime(r.starts_at))).toEqual(["2026-10-23T20:00", "2026-10-30T20:00", "2026-11-06T20:00"]);
    expect(wallTime(rows[1]?.ends_at ?? null)).toBe("2026-10-31T00:30");
  });
  it("ripete giornalmente e ogni due settimane", () => {
    expect(wallTime(occurrenceDates("2026-10-23T21:00", "2026-10-23T23:00", "Europe/Rome", "daily", 2)[1]?.starts_at ?? null)).toBe("2026-10-24T21:00");
    expect(wallTime(occurrenceDates("2026-10-23T21:00", "2026-10-23T23:00", "Europe/Rome", "fortnightly", 2)[1]?.starts_at ?? null)).toBe("2026-11-06T21:00");
  });
  it("la ricorrenza mensile conserva il giorno originale senza deriva", () => {
    expect(occurrenceDates("2027-01-31T20:00", "2027-01-31T23:00", "Europe/Rome", "monthly", 3).map(r => wallTime(r.starts_at).slice(0, 10))).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });
  it("impedisce intervalli invertiti e quantità non valide", () => {
    expect(() => occurrenceDates("2026-10-23T23:00", "2026-10-23T20:00", "Europe/Rome", "weekly", 2)).toThrow();
    expect(() => occurrenceDates("2026-10-23T20:00", "2026-10-23T23:00", "Europe/Rome", "weekly", 53)).toThrow();
  });
});
describe("Giochi ricordati", () => {
  it("riusa giochi senza duplicati di maiuscole o accenti", () => { expect(mergeGames(["Pokémon", " pokemon ", "Magic"])).toEqual(["Magic", "Pokémon"]); });
  it("ricorda i giochi per account anche dopo una nuova lettura", () => {
    localStorage.removeItem(gamesKey("test-games"));
    rememberGame("test-games", "Riftbound");
    expect(readGames("test-games")).toEqual(["Riftbound"]);
    expect(readGames("another-account")).toEqual([]);
    localStorage.removeItem(gamesKey("test-games"));
  });
});