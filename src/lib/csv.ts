import type { Booking, Client } from "@/lib/data";

type Cell = string | number;

// Semicolon separator and decimal comma so Excel with Italian settings opens the file in columns.
export function toCsv(rows: Cell[][]) {
  const cell = (v: Cell) => {
    const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

export function clientsExportRows(
  clients: Pick<Client, "id" | "first_name" | "last_name">[],
  balances: Map<string, { balance: number }>,
  bookings: (Pick<Booking, "client_id" | "status"> & { events: { name: string } | null })[],
): Cell[][] {
  const header = ["Cognome", "Nome", "Saldo buono (€)", "Prenotazioni attive", "Eventi prenotati"];
  const sorted = [...clients].sort(
    (a, b) =>
      a.last_name.localeCompare(b.last_name, "it") ||
      a.first_name.localeCompare(b.first_name, "it"),
  );
  return [
    header,
    ...sorted.map((c) => {
      const active = bookings.filter((b) => b.client_id === c.id && b.status !== "annullata");
      const eventNames = [...new Set(active.map((b) => b.events?.name).filter(Boolean))];
      return [
        c.last_name,
        c.first_name,
        balances.get(c.id)?.balance ?? 0,
        String(active.length),
        eventNames.join(", "),
      ];
    }),
  ];
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
