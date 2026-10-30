import { describe, expect, it } from "vitest";
import { monthDays, shiftEntrySchema, shiftTokenSchema } from "@/lib/shifts";

describe("Disponibilità personali", () => {
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