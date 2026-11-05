import { describe, expect, it } from "vitest";
import { assignmentInputSchema, assignmentMinutes, assignmentTime, availabilityDeadline, criticalDays, formatHours, hoursByCollaborator, hoursExportRows, isAvailabilityLocked, monthDays, monthWeeks, movePeriod, planChanges, planKey, planningOrder, planSlots, pendingPublication, periodDays, periodLabel, shiftHistoryChanges, shiftsExportRows, toAssignmentStatus, shiftEntrySchema, shiftTokenSchema, type ShiftAssignment } from "@/lib/shifts";

describe("Disponibilità personali", () => {
  const assignment = { collaborator_id: "00000000-0000-4000-8000-000000000001", day: "2026-10-30", starts_at: "20:00", ends_at: "23:00", ends_next_day: false, note: "Banco" };
  it("non lascia scegliere a mano lo stato del turno", () => {
    const parsed = assignmentInputSchema.parse({ ...assignment, status: "pubblicato" });
    expect(parsed).not.toHaveProperty("status");
  });
  it("riconosce gli stati Bozza, Pubblicato e Modificato e conta i turni da pubblicare", () => {
    expect(["bozza", "pubblicato", "modificato", "accettato"].map(toAssignmentStatus)).toEqual(["bozza", "pubblicato", "modificato", "bozza"]);
    expect(pendingPublication([{ status: "bozza" }, { status: "pubblicato" }, { status: "modificato" }])).toBe(2);
  });
  it("mantiene gli orari dei turni in formato 24 ore", () => {
    expect(assignmentTime(assignmentInputSchema.parse(assignment))).toBe("20:00–23:00");
    expect(assignmentInputSchema.safeParse({ ...assignment, starts_at: "25:00" }).success).toBe(false);
  });
  it("consente fine dopo mezzanotte solo con giorno successivo", () => {
    expect(assignmentInputSchema.safeParse({ ...assignment, ends_at: "00:30" }).success).toBe(false);
    const overnight = assignmentInputSchema.parse({ ...assignment, ends_at: "00:30", ends_next_day: true });
    expect(assignmentTime(overnight)).toBe("20:00–00:30 (+1 giorno)");
  });
  it("accetta solo i tre stati richiesti", () => {
    for (const status of ["disponibile", "assente", "meglio_di_no"]) expect(shiftEntrySchema.safeParse({ day: "2026-10-30", status, note: "dopo le 18" }).success).toBe(true);
    expect(shiftEntrySchema.safeParse({ day: "2026-10-30", status: "completato", note: "" }).success).toBe(false);
  });
  it("preserva le note per giorno", () => {
    expect(shiftEntrySchema.parse({ day: "2026-10-30", status: "disponibile", note: "Disponibile dopo le 18" }).note).toBe("Disponibile dopo le 18");
  });
  it("rifiuta date inesistenti", () => {
    expect(shiftEntrySchema.safeParse({ day: "2026-02-30", status: "assente", note: "" }).success).toBe(false);
  });
  it("richiede un link con segreto di 256 bit", () => {
    expect(shiftTokenSchema.safeParse("abc").success).toBe(false);
    expect(shiftTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
  });
  it("allinea il mese da lunedì a domenica", () => {
    const days = monthDays("2026-10");
    expect(days[0]).toBe("2026-09-28");
    expect(days.at(-1)).toBe("2026-11-01");
  });
});
describe("Ore e controlli dei turni", () => {
  const base = { id: "a", collaborator_id: "p1", status: "pubblicato" as const, published_at: null, note: "", updated_at: "", ends_next_day: false };
  const shift = (day: string, starts_at: string, ends_at: string, extra: Partial<ShiftAssignment> = {}): ShiftAssignment => ({ ...base, day, starts_at, ends_at, ...extra });
  it("conta i turni oltre la mezzanotte sul giorno di inizio", () => {
    expect(assignmentMinutes(shift("2026-09-03", "15:00", "00:30", { ends_next_day: true }))).toBe(570);
  });
  it("conta le ore reali nelle notti del cambio d'ora", () => {
    expect(assignmentMinutes(shift("2026-10-24", "22:00", "02:00", { ends_next_day: true }))).toBe(300);
    expect(assignmentMinutes(shift("2026-03-28", "22:00", "04:00", { ends_next_day: true }))).toBe(300);
  });
  it("somma ore e turni per collaboratore nel periodo", () => {
    const totals = hoursByCollaborator([
      shift("2026-09-03", "15:00", "00:30", { ends_next_day: true }), shift("2026-09-05", "16:00", "23:00"), shift("2026-09-08", "14:00", "22:00"),
      shift("2026-09-10", "10:00", "12:00", { status: "bozza" }), shift("2026-10-01", "10:00", "12:00"),
    ], "2026-09-01", "2026-09-30");
    expect(totals.get("p1")).toEqual({ shifts: 4, minutes: 1590 });
    expect(formatHours(1470)).toBe("24,5");
  });
  it("chiude le disponibilità della settimana alla fine del venerdì precedente", () => {
    for (const day of ["2026-11-09", "2026-11-15"]) expect(availabilityDeadline(day).toISOString()).toBe("2026-11-06T23:00:00.000Z");
    expect(isAvailabilityLocked("2026-11-09", new Date("2026-11-06T22:59:00Z"))).toBe(false);
    expect(isAvailabilityLocked("2026-11-09", new Date("2026-11-06T23:00:00Z"))).toBe(true);
  });
  it("segnala i giorni con meno di tre persone e chi non ha compilato", () => {
    const people = [{ id: "p1", active: true }, { id: "p2", active: true }, { id: "p3", active: true }, { id: "p4", active: false }];
    const result = criticalDays(["2026-11-09", "2026-11-10"], people,
      ["p1", "p2", "p3"].map(id => shift("2026-11-09", "10:00", "18:00", { collaborator_id: id })).concat(shift("2026-11-10", "10:00", "18:00")),
      [{ collaborator_id: "p1", day: "2026-11-10" }, { collaborator_id: "p2", day: "2026-11-10" }]);
    expect(result).toEqual([{ day: "2026-11-10", assigned: 1, missing: [{ id: "p3", active: true }] }]);
  });
});

describe("Viste, export e cronologia turni", () => {
  const base = { note: "", updated_at: "", published_at: null, ends_next_day: false } as const;
  const people = [
    { id: "b", first_name: "Bruno", last_name: "Verdi", active: true },
    { id: "a", first_name: "Anna", last_name: "Rossi", active: true },
    { id: "c", first_name: "Carla", last_name: "Neri", active: false },
  ];
  const shifts: ShiftAssignment[] = [
    { ...base, id: "1", collaborator_id: "b", day: "2026-11-03", starts_at: "18:00", ends_at: "22:30", status: "bozza" },
    { ...base, id: "2", collaborator_id: "a", day: "2026-11-03", starts_at: "15:00", ends_at: "19:00", status: "pubblicato", note: "=cassa" },
    { ...base, id: "3", collaborator_id: "a", day: "2026-11-10", starts_at: "15:00", ends_at: "17:00", status: "modificato" },
  ];
  it("calcola i giorni di giorno, settimana (lun-dom anche a cavallo del mese) e mese", () => {
    expect(periodDays("giorno", "2026-11-05")).toEqual(["2026-11-05"]);
    expect(periodDays("settimana", "2026-12-02")).toEqual(["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"]);
    const november = periodDays("mese", "2026-11-17");
    expect([november.length, november[0], november.at(-1)]).toEqual([30, "2026-11-01", "2026-11-30"]);
  });
  it("sposta il periodo e lo descrive in italiano", () => {
    expect(movePeriod("giorno", "2026-10-31", 1)).toBe("2026-11-01");
    expect(movePeriod("settimana", "2026-11-05", -1)).toBe("2026-10-29");
    expect(movePeriod("mese", "2026-01-31", 1)).toBe("2026-02-01");
    expect(periodLabel("mese", "2026-11-05")).toBe("novembre 2026");
    expect(periodLabel("settimana", "2026-11-05")).toBe("2 – 8 novembre 2026");
    expect(periodLabel("settimana", "2026-12-02")).toBe("30 novembre – 6 dicembre 2026");
    expect(periodLabel("giorno", "2026-11-05")).toBe("giovedì 5 novembre 2026");
  });
  it("esporta i turni in ordine di data e orario con ore e stato", () => {
    const rows = shiftsExportRows(people, shifts);
    expect(rows[0]).toEqual(["Data", "Cognome", "Nome", "Inizio", "Fine", "Finisce il giorno dopo", "Ore", "Stato", "Note"]);
    expect(rows.slice(1).map(r => [r[0], r[1], r[6], r[7]])).toEqual([["2026-11-03", "Rossi", 4, "Pubblicato"], ["2026-11-03", "Verdi", 4.5, "Bozza"], ["2026-11-10", "Rossi", 2, "Modificato"]]);
  });
  it("esporta le ore del periodo per collaboratore con il totale", () => {
    expect(hoursExportRows(people, shifts, "2026-11-01", "2026-11-08")).toEqual([
      ["Cognome", "Nome", "Turni", "Ore"], ["Rossi", "Anna", "1", 4], ["Verdi", "Bruno", "1", 4.5], ["Totale", "", "2", 8.5],
    ]);
  });
  it("descrive le modifiche registrate nello storico", () => {
    const before = { starts_at: "15:00:00", ends_at: "19:00:00", ends_next_day: false, status: "pubblicato", note: "" };
    expect(shiftHistoryChanges("turno", before, { ...before, ends_at: "20:00:00", status: "modificato" })).toEqual(["Orario: 15:00–19:00 → 15:00–20:00", "Stato: Pubblicato → Modificato"]);
    expect(shiftHistoryChanges("turno", null, before)).toEqual(["Orario: 15:00–19:00", "Stato: Pubblicato"]);
    expect(shiftHistoryChanges("disponibilita", { status: "disponibile", note: "" }, null)).toEqual(["Disponibilità: Disponibile → —"]);
  });
});

describe("Pianificazione settimanale", () => {
  const A = "00000000-0000-4000-8000-00000000000a"; const B = "00000000-0000-4000-8000-00000000000b"; const C = "00000000-0000-4000-8000-00000000000c";
  const published: ShiftAssignment = { id: "1", collaborator_id: A, day: "2026-11-10", starts_at: "15:00:00", ends_at: "19:00:00", ends_next_day: false, note: "", status: "pubblicato", published_at: null, updated_at: "" };
  it("divide il mese in settimane da lunedì a domenica", () => {
    const weeks = monthWeeks("2026-11");
    expect(weeks.every(w => w.length === 7)).toBe(true);
    expect(weeks[0]?.[0]).toBe("2026-10-26");
    expect(weeks.at(-1)?.at(-1)).toBe("2026-12-06");
  });
  it("mette prima i disponibili, poi meglio di no, non compilati e assenti", () => {
    const people = [{ id: A, first_name: "Anna", last_name: "Zeta" }, { id: B, first_name: "Bruno", last_name: "Alfa" }, { id: C, first_name: "Carla", last_name: "Beta" }, { id: "d", first_name: "Dario", last_name: "Gamma" }];
    const entries = [{ collaborator_id: A, day: "2026-11-10", status: "assente", note: "" }, { collaborator_id: C, day: "2026-11-10", status: "disponibile", note: "dopo le 16" }, { collaborator_id: B, day: "2026-11-10", status: "meglio_di_no", note: "" }, { collaborator_id: "d", day: "2026-11-11", status: "disponibile", note: "" }];
    expect(planningOrder(people, entries, "2026-11-10").map(r => r.person.first_name)).toEqual(["Carla", "Bruno", "Dario", "Anna"]);
  });
  it("invia solo i turni cambiati, così i pubblicati intatti non diventano Modificato", () => {
    const slots = planSlots([published], ["2026-11-10", "2026-11-11"]);
    expect(slots[planKey(A, "2026-11-10")]).toMatchObject({ on: true, starts_at: "15:00", ends_at: "19:00" });
    expect(planChanges([published], slots)).toEqual({ save: [], remove: [], errors: [] });
    slots[planKey(B, "2026-11-11")] = { on: true, starts_at: "18:00", ends_at: "23:00", ends_next_day: false, note: "" };
    slots[planKey(A, "2026-11-10")] = { ...slots[planKey(A, "2026-11-10")]!, ends_at: "20:00" };
    expect(planChanges([published], slots).save.map(s => `${s.collaborator_id}:${s.ends_at}`)).toEqual([`${A}:20:00`, `${B}:23:00`]);
  });
  it("rimuove i turni tolti e segnala gli orari mancanti o sbagliati", () => {
    const slots = { [planKey(A, "2026-11-10")]: { on: false, starts_at: "15:00", ends_at: "19:00", ends_next_day: false, note: "" }, [planKey(B, "2026-11-11")]: { on: true, starts_at: "", ends_at: "", ends_next_day: false, note: "" }, [planKey(C, "2026-11-12")]: { on: true, starts_at: "20:00", ends_at: "02:00", ends_next_day: false, note: "" }, [planKey(C, "2026-11-13")]: { on: false, starts_at: "", ends_at: "", ends_next_day: false, note: "" } };
    const r = planChanges([published], slots, new Map([[B, "Bruno Alfa"]]));
    expect(r.remove).toEqual([{ collaborator_id: A, day: "2026-11-10" }]);
    expect(r.save).toEqual([]);
    expect(r.errors[0]).toBe("Bruno Alfa, mercoledì 11: inserisci inizio e fine");
    expect(r.errors[1]).toContain("giorno successivo");
  });
});
