import { describe, expect, it } from "vitest";
import { assignmentInputSchema, assignmentMinutes, assignmentTime, availabilityDeadline, criticalDays, formatHours, hoursByCollaborator, isAvailabilityLocked, monthDays, pendingPublication, toAssignmentStatus, shiftEntrySchema, shiftTokenSchema, type ShiftAssignment } from "@/lib/shifts";

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
