import { describe, expect, it } from "vitest";
import { emptyEventDetails, formatEventDescription, parseEventDescription } from "@/lib/event-details";

describe("Event details", () => {
  it("starts new events with an editable Top Cut of 8", () => {
    expect(emptyEventDetails(true).topCut).toBe("8");
    const details = { ...emptyEventDetails(true), topCut: "16" };
    expect(parseEventDescription(formatEventDescription(details, "")).details.topCut).toBe("16");
  });
  it("preserves entered price, rounds, prizes, materials and promo after saving", () => {
    const details = { cost: "40 €", swiss: "4 round", topCut: "8", prizes: "1 busta", materials: "Kit prerelease", promo: "Promo partecipazione" };
    expect(parseEventDescription(formatEventDescription(details, "Iscrizioni in negozio"))).toEqual({ details, notes: "Iscrizioni in negozio" });
  });
  it("does not invent missing details for existing events or lose their notes", () => {
    const parsed = parseEventDescription("Evento in negozio\n🎟️ Costo: 40 €\n🏆 Top Cut: 8");
    expect(parsed.details).toEqual({ ...emptyEventDetails(), cost: "40 €", topCut: "8" });
    expect(parsed.notes).toBe("Evento in negozio");
    expect(parseEventDescription(formatEventDescription(parsed.details, parsed.notes))).toEqual(parsed);
  });
});