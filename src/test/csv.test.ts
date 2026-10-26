import { describe, expect, it } from "vitest";
import { clientsExportRows, toCsv } from "@/lib/csv";

describe("esportazione CSV clienti", () => {
  it("usa punto e virgola, virgola decimale e virgolette solo dove servono", () => {
    expect(toCsv([["Rossi", "Mario", 25.5, "2", 'Torneo "Local"; finale']])).toBe(
      'Rossi;Mario;25,50;2;"Torneo ""Local""; finale"',
    );
    expect(toCsv([["a"], ["b"]])).toBe("a\r\nb");
  });

  it("una riga per cliente in ordine di cognome, senza prenotazioni annullate", () => {
    const clients = [
      { id: "2", first_name: "Luca", last_name: "Verdi" },
      { id: "1", first_name: "Anna", last_name: "Bianchi" },
    ];
    const balances = new Map([["1", { balance: 40 }]]);
    const bookings = [
      { client_id: "1", status: "da_preparare" as const, events: { name: "Radiance release" } },
      { client_id: "1", status: "consegnata" as const, events: { name: "Radiance release" } },
      { client_id: "1", status: "annullata" as const, events: { name: "Altro evento" } },
      { client_id: "2", status: "annullata" as const, events: { name: "Radiance release" } },
    ];
    expect(clientsExportRows(clients, balances, bookings)).toEqual([
      ["Cognome", "Nome", "Saldo buono (€)", "Prenotazioni attive", "Eventi prenotati"],
      ["Bianchi", "Anna", 40, "2", "Radiance release"],
      ["Verdi", "Luca", 0, "0", ""],
    ]);
  });
});
