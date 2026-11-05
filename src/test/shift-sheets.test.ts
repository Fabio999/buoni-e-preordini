import { describe, expect, it } from "vitest";
import { lateEdits, parseSheetDate, parseSheetRows, publicationEmail, SHEET_HEADER, sheetFormatRequests, sheetRows, sheetWindow, shiftCell, shiftColumn } from "@/lib/shift-sheets";
import type { ShiftAssignment } from "@/lib/shifts";

const thursday = new Date("2026-11-05T15:00:00+01:00");
const shift = (day: string, status: ShiftAssignment["status"], extra: Partial<ShiftAssignment> = {}): ShiftAssignment => ({ id: day, collaborator_id: "a", day, starts_at: "15:00:00", ends_at: "19:00:00", ends_next_day: false, note: "", updated_at: "", published_at: null, status, ...extra });
function decode(b64url: string) {
  const bin = atob(b64url.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

describe("Foglio Google del collaboratore", () => {
  it("mostra 5 settimane a partire dal lunedì della settimana in corso", () => {
    const days = sheetWindow(thursday);
    expect([days.length, days[0], days.at(-1)]).toEqual([35, "2026-11-02", "2026-12-06"]);
  });
  it("legge solo date gg/mm/aaaa esistenti", () => {
    expect(parseSheetDate("9/11/2026")).toBe("2026-11-09");
    expect(parseSheetDate("31/02/2026")).toBeNull();
    expect(parseSheetDate("2026-11-09")).toBeNull();
  });
  it("scrive data, giorno, disponibilità, nota e solo i turni pubblicati o modificati", () => {
    const rows = sheetRows(["2026-11-09", "2026-11-10", "2026-11-11"], [{ day: "2026-11-09", status: "meglio_di_no", note: "dopo le 16" }], [shift("2026-11-09", "pubblicato"), shift("2026-11-10", "bozza"), shift("2026-11-11", "modificato", { note: "cassa" })]);
    expect(rows[0]).toEqual(SHEET_HEADER);
    expect(rows[1]).toEqual(["09/11/2026", "lunedì", "Solo in caso di necessità", "dopo le 16", "15:00–19:00"]);
    expect(rows[2]?.[4]).toBe("");
    expect(rows[3]?.[4]).toBe("15:00–19:00 (modificato) — cassa");
    expect(shiftCell(shift("2026-11-12", "pubblicato", { ends_at: "01:00:00", ends_next_day: true }))).toBe("15:00–01:00 (+1 giorno)");
  });
  it("importa solo le settimane ancora aperte e segnala i valori non validi", () => {
    const parsed = parseSheetRows([
      ["06/11/2026", "venerdì", "Disponibile", ""],
      ["09/11/2026", "lunedì", " non disponibile ", " malato "],
      ["10/11/2026", "martedì", "", ""],
      ["11/11/2026", "mercoledì", "Forse", ""],
      ["09/11/2026", "lunedì", "Disponibile", "doppione"],
      ["Totale", "", "Disponibile", ""],
    ], thursday);
    expect(parsed.locked).toEqual([{ day: "2026-11-06", status: "disponibile", note: "" }]);
    expect(lateEdits(parsed.locked, [{ day: "2026-11-06", status: "assente", note: "" }])).toEqual(["06/11/2026"]);
    expect(lateEdits(parsed.locked, [{ day: "2026-11-06", status: "disponibile", note: "" }])).toEqual([]);
    expect(parsed.rows).toEqual([{ day: "2026-11-09", status: "assente", note: "malato" }, { day: "2026-11-10", status: "", note: "" }]);
    expect(parsed.invalid).toEqual(["11/11/2026: «Forse»"]);
  });
  it("lascia modificabili solo Disponibilità e Nota delle righe aperte", () => {
    const days = sheetWindow(thursday);
    const requests = sheetFormatRequests(days, [7, 8], thursday);
    expect(requests.slice(0, 2)).toEqual([{ deleteProtectedRange: { protectedRangeId: 7 } }, { deleteProtectedRange: { protectedRangeId: 8 } }]);
    const protection = requests.find(r => "addProtectedRange" in r) as { addProtectedRange: { protectedRange: { unprotectedRanges: unknown[] } } };
    expect(protection.addProtectedRange.protectedRange.unprotectedRanges).toEqual([{ sheetId: 0, startRowIndex: 8, endRowIndex: 36, startColumnIndex: 2, endColumnIndex: 4 }]);
    const allLocked = sheetFormatRequests(days, [], new Date("2027-01-01T12:00:00Z"));
    expect((allLocked.find(r => "addProtectedRange" in r) as typeof protection).addProtectedRange.protectedRange.unprotectedRanges).toEqual([]);
  });
  it("allinea la colonna Turno alle date presenti nel foglio", () => {
    expect(shiftColumn([["09/11/2026"], ["x"], ["10/11/2026"]], [shift("2026-11-10", "pubblicato")])).toEqual([[""], [""], ["15:00–19:00"]]);
  });
  it("prepara la mail di pubblicazione in UTF-8", () => {
    const raw = decode(publicationEmail({ to: "fabio@example.com", firstName: "Fabio", shifts: [shift("2026-11-10", "pubblicato"), shift("2026-11-09", "pubblicato", { note: "banco" })], link: "https://docs.google.com/spreadsheets/d/abc" }));
    const [head, body] = raw.split("\r\n\r\n");
    expect(head).toContain("To: fabio@example.com");
    expect(decode((head!.match(/=\?UTF-8\?B\?(.+)\?=/) ?? [])[1]!)).toBe("Mana Flask — i tuoi turni");
    const text = decode(body!.replace(/\r\n/g, ""));
    expect(text).toContain("Ciao Fabio,");
    expect(text.indexOf("lunedì 9 novembre: 15:00–19:00 (banco)")).toBeLessThan(text.indexOf("martedì 10 novembre"));
    expect(text).toContain("https://docs.google.com/spreadsheets/d/abc");
  });
});
