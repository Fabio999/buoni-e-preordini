import { describe, expect, it } from "vitest";
import { assignmentInputSchema, assignmentTime, monthDays, shiftEntrySchema, shiftTokenSchema } from "@/lib/shifts";

describe("Disponibilità personali", () => {
  const assignment = { collaborator_id: "00000000-0000-4000-8000-000000000001", day: "2026-10-30", status: "accettato", starts_at: "20:00", ends_at: "23:00", ends_next_day: false, note: "Banco" };
  it("consente turni solo accettati o rifiutati", () => {
    for (const status of ["accettato", "rifiutato"]) expect(assignmentInputSchema.safeParse({ ...assignment, status }).success).toBe(true);
    expect(assignmentInputSchema.safeParse({ ...assignment, status: "disponibile" }).success).toBe(false);
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