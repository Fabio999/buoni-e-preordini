import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { BookingsTable } from "@/components/BookingsTable";
import { BookingDialog } from "@/components/forms/BookingDialog";
import { selectClass } from "@/components/forms/SimpleDialogs";
import { Section } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { useBookings, useClients, useEvents } from "@/lib/data";
import { BOOKING_STATUS, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/prenotazioni")({
  head: () => ({
    meta: [
      { title: "Prenotazioni — Mana Flask" },
      { name: "description", content: "Gestisci prenotazioni, stato di preparazione e pagamenti." },
      { property: "og:title", content: "Prenotazioni — Mana Flask" },
      { property: "og:description", content: "Gestisci prenotazioni, stato di preparazione e pagamenti." },
    ],
  }),
  component: BookingsPage,
});

function BookingsPage() {
  const { data: bookings = [] } = useBookings();
  const { data: events = [] } = useEvents();
  const { data: clients = [] } = useClients();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ event: "", client: "", status: "", payment: "" });

  const filtered = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (!f.event || b.event_id === f.event) &&
          (!f.client || b.client_id === f.client) &&
          (!f.status || b.status === f.status) &&
          (!f.payment || b.payment_status === f.payment),
      ),
    [bookings, f],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Prenotazioni"
        subtitle="Clicca sul pagamento per cambiarlo al volo."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nuova prenotazione
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <select className={selectClass} value={f.event} onChange={(e) => setF({ ...f, event: e.target.value })}>
          <option value="">Tutti gli eventi</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} — {fmtDate(e.event_date)}
            </option>
          ))}
        </select>
        <select className={selectClass} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })}>
          <option value="">Tutti i clienti</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.last_name} {c.first_name}
            </option>
          ))}
        </select>
        <select className={selectClass} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">Tutti gli stati</option>
          {Object.entries(BOOKING_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select className={selectClass} value={f.payment} onChange={(e) => setF({ ...f, payment: e.target.value })}>
          <option value="">Tutti i pagamenti</option>
          <option value="pagato">🟢 PAGATO</option>
          <option value="non_pagato">🔴 NON PAGATO</option>
        </select>
      </div>
      <Section title={`${filtered.length} prenotazioni`}>
        <BookingsTable bookings={filtered} />
      </Section>
      <BookingDialog open={open} onOpenChange={setOpen} defaultEventId={f.event || undefined} defaultClientId={f.client || undefined} />
    </div>
  );
}
