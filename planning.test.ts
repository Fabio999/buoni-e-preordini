import { describe, it, expect } from "vitest";
import { isOverdue, confirmAlternative, alternativesOf, overlaps, toInstant, wallTime, upcomingEvents, archivedEvents, eventsByMonth, dayLabel } from "@/lib/planning";

describe("task e calendario", () => {
  it("gli eventi in programma includono quelli in corso, escludono passati e archiviati e sono ordinati per inizio", () => {
    const events = [
      {id:"futuro",archived:false,starts_at:"2026-10-24T18:00:00Z",ends_at:"2026-10-24T22:00:00Z"},
      {id:"passato",archived:false,starts_at:"2026-10-22T18:00:00Z",ends_at:"2026-10-22T22:00:00Z"},
      {id:"archiviato",archived:true,starts_at:"2026-10-25T18:00:00Z",ends_at:"2026-10-25T22:00:00Z"},
      {id:"in-corso",archived:false,starts_at:"2026-10-23T18:00:00Z",ends_at:"2026-10-24T00:30:00Z"},
    ];
    expect(upcomingEvents(events,new Date("2026-10-23T21:53:00Z")).map(e => e.id)).toEqual(["in-corso","futuro"]);
  });
  it("in archivio finiscono gli eventi terminati e quelli archiviati a mano, dal più recente", () => {
    const events = [
      {id:"vecchio",archived:false,starts_at:"2026-10-20T18:00:00Z",ends_at:"2026-10-20T22:00:00Z"},
      {id:"futuro-archiviato",archived:true,starts_at:"2026-10-25T18:00:00Z",ends_at:"2026-10-25T22:00:00Z"},
      {id:"in-corso",archived:false,starts_at:"2026-10-23T18:00:00Z",ends_at:"2026-10-24T00:30:00Z"},
      {id:"appena-finito",archived:false,starts_at:"2026-10-23T17:00:00Z",ends_at:"2026-10-23T21:53:00Z"},
    ];
    const now = new Date("2026-10-23T21:53:00.001Z");
    expect(archivedEvents(events,now).map(e => e.id)).toEqual(["futuro-archiviato","appena-finito","vecchio"]);
    const all = [...upcomingEvents(events,now), ...archivedEvents(events,now)].map(e => e.id).sort();
    expect(all).toEqual(events.map(e => e.id).sort());
  });
  it("i prossimi eventi sono divisi per mese secondo l'ora italiana", () => {
    const events = [
      {id:"ottobre",starts_at:"2026-10-30T19:00:00Z"},
      {id:"notte-di-halloween",starts_at:"2026-10-31T23:30:00Z"},
      {id:"novembre",starts_at:"2026-11-02T19:15:00Z"},
      {id:"gennaio",starts_at:"2027-01-05T19:00:00Z"},
    ];
    expect(eventsByMonth(events).map(g => [g.label, g.events.map(e => e.id)])).toEqual([
      ["Ottobre 2026", ["ottobre"]],
      ["Novembre 2026", ["notte-di-halloween","novembre"]],
      ["Gennaio 2027", ["gennaio"]],
    ]);
  });
  it("le date vicine diventano Oggi e Domani secondo l'ora italiana, anche al cambio d'ora", () => {
    const now = new Date("2026-10-24T22:30:00Z");
    expect(dayLabel("2026-10-25T08:00:00Z", now)).toBe("Oggi");
    expect(dayLabel("2026-10-25T23:30:00Z", now)).toBe("Domani");
    expect(dayLabel("2026-10-24T21:00:00Z", now)).toBe("Sab 24 ott");
    expect(dayLabel("2026-10-28T19:30:00Z", now)).toBe("Mer 28 ott");
  });
  it("una scadenza superata resta aperta, non completa la task", () => {
    const task = {status:"in_corso",archived:false,due_at:"2026-10-20T08:00:00Z"};
    expect(isOverdue(task,new Date("2026-10-23T10:00:00Z"))).toBe(true);
    expect(task.status).toBe("in_corso");
    expect(isOverdue({...task,status:"completata"},new Date("2026-10-23T10:00:00Z"))).toBe(false);
  });
  it("confermare una data conserva le alternative e la data precedente", () => {
    const a={starts_at:"2026-10-24T08:00:00Z",ends_at:"2026-10-24T09:00:00Z"};
    const old={starts_at:"2026-10-23T08:00:00Z",ends_at:"2026-10-23T09:00:00Z",alternatives:[a]};
    const result=confirmAlternative(old,a);
    expect(result.starts_at).toBe(a.starts_at);
    expect(result.confirmed).toBe(true);
    expect(alternativesOf(result)).toEqual([a,{starts_at:old.starts_at,ends_at:old.ends_at}]);
  });
  it("orari italiani rispettano il cambio da ora legale a solare", () => {
    expect(toInstant("2026-10-23T09:00")).toBe("2026-10-23T07:00:00.000Z");
    expect(toInstant("2026-10-26T09:00")).toBe("2026-10-26T08:00:00.000Z");
    expect(wallTime("2026-10-26T08:00:00Z")).toBe("2026-10-26T09:00");
  });
  it("eventi sovrapposti sono riconosciuti, eventi consecutivi no", () => {
    const a={starts_at:"2026-10-23T08:00:00Z",ends_at:"2026-10-23T09:00:00Z"};
    expect(overlaps(a,{starts_at:"2026-10-23T08:30:00Z",ends_at:"2026-10-23T10:00:00Z"})).toBe(true);
    expect(overlaps(a,{starts_at:a.ends_at,ends_at:"2026-10-23T10:00:00Z"})).toBe(false);
  });
});