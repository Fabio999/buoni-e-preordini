import { describe, expect, it } from "vitest";
import { occurrenceDates, recurrenceTargets, recurrenceColorUpdates, mergeGames, rememberGame, readGames, gamesKey } from "../lib/event-recurrence";
import { wallTime } from "../lib/planning";
describe("Ricorrenze evento", () => {
  it("propaga il colore solo dalla data modificata in avanti preservando date e dettagli", () => {
    const events = [
      {id:"past", recurrence_series:"nexus", starts_at:"2026-10-20T18:00:00Z", archived:false, color:"blu", description:"Prima"},
      {id:"current", recurrence_series:"nexus", starts_at:"2026-10-27T19:00:00Z", archived:false, color:"blu", description:"Attuale"},
      {id:"next", recurrence_series:"nexus", starts_at:"2026-11-03T19:00:00Z", archived:false, color:"blu", description:"Premi diversi"},
      {id:"other", recurrence_series:"magic", starts_at:"2026-11-03T19:00:00Z", archived:false, color:"blu", description:"Altro"},
    ];
    const current = events[1];
    if (!current) throw new Error("Missing current occurrence");
    const rows = recurrenceColorUpdates(events, current, "viola");
    expect(rows.map(e => [e.id,e.color])).toEqual([["current","viola"],["next","viola"]]);
    expect(rows[1]).toEqual({...events[2],color:"viola"});
    expect(recurrenceColorUpdates(events,current,"blu")).toEqual([]);
  });
  it("modifica una sola data oppure questa e le successive della stessa serie senza toccare il passato", () => {
    const events = [
      {id:"past", recurrence_series:"nexus", starts_at:"2026-10-20T18:00:00Z", archived:false},
      {id:"current", recurrence_series:"nexus", starts_at:"2026-10-27T19:00:00Z", archived:false},
      {id:"next", recurrence_series:"nexus", starts_at:"2026-11-03T19:00:00Z", archived:false},
      {id:"other", recurrence_series:"magic", starts_at:"2026-11-03T19:00:00Z", archived:false},
    ];
    const current = events[1];
    if (!current) throw new Error("Missing current occurrence");
    expect(recurrenceTargets(events,current,false).map(e => e.id)).toEqual(["current"]);
    expect(recurrenceTargets(events,current,true).map(e => e.id)).toEqual(["current","next"]);
    const dates=occurrenceDates("2026-10-27T20:00","2026-10-28T00:30","Europe/Rome","weekly",2,4);
    expect(dates.map(e => wallTime(e.starts_at))).toEqual(["2026-10-29T20:00","2026-11-05T20:00"]);
  });
  it("fissa Nexus Night al martedì successivo conservando le ore serali e la fine il giorno dopo", () => {
    const rows = occurrenceDates("2026-10-23T20:00", "2026-10-24T00:30", "Europe/Rome", "weekly", 3, 2);
    expect(rows.map(r => wallTime(r.starts_at))).toEqual(["2026-10-27T20:00", "2026-11-03T20:00", "2026-11-10T20:00"]);
    expect(rows.map(r => wallTime(r.ends_at))).toEqual(["2026-10-28T00:30", "2026-11-04T00:30", "2026-11-11T00:30"]);
  });
  it("include il primo giorno se è già martedì e rispetta la cadenza bisettimanale", () => {
    expect(occurrenceDates("2026-10-27T21:00", "2026-10-27T23:00", "Europe/Rome", "fortnightly", 2, 2).map(r => wallTime(r.starts_at))).toEqual(["2026-10-27T21:00", "2026-11-10T21:00"]);
  });
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