import { describe, expect, it } from "vitest";
import { activityInRange, lastActivityByClient } from "@/lib/data";

describe("ultima modifica dei clienti", () => {
  const clients = [
    { id: "anna", created_at: "2026-01-10T10:00:00+00:00" },
    { id: "bruno", created_at: "2026-09-01T10:00:00+00:00" },
  ];

  it("prende la data più recente tra creazione, movimenti e prenotazioni", () => {
    const movements = [
      { client_id: "anna", created_at: "2026-10-20T18:00:00+00:00" },
      { client_id: "anna", created_at: "2026-03-01T18:00:00+00:00" },
    ];
    const bookings = [
      { client_id: "anna", created_at: "2026-10-22T09:30:00+00:00" },
      { client_id: "ignoto", created_at: "2026-10-25T09:30:00+00:00" },
    ];
    const last = lastActivityByClient(clients, movements, bookings);
    expect(last.get("anna")).toBe("2026-10-22T09:30:00+00:00");
    expect(last.get("bruno")).toBe("2026-09-01T10:00:00+00:00");
    expect(last.has("ignoto")).toBe(false);
  });

  it("filtra per giorni trascorsi, con i 90 giorni esatti dentro e non oltre", () => {
    const now = new Date("2026-10-26T12:00:00Z");
    expect(activityInRange("2026-10-20T12:00:00Z", "7", now)).toBe(true);
    expect(activityInRange("2026-10-18T12:00:00Z", "7", now)).toBe(false);
    expect(activityInRange("2026-07-28T12:00:00Z", "90", now)).toBe(true);
    expect(activityInRange("2026-07-28T12:00:00Z", "oltre90", now)).toBe(false);
    expect(activityInRange("2026-07-01T12:00:00Z", "oltre90", now)).toBe(true);
    expect(activityInRange("2020-01-01T00:00:00Z", "", now)).toBe(true);
  });
});
