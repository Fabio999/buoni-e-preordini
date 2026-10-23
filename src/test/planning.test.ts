import { describe, it, expect } from "vitest";
import { isOverdue, confirmAlternative, alternativesOf, overlaps, toInstant, wallTime, upcomingEvents } from "@/lib/planning";

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