import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { EventDialog } from "@/components/forms/SimpleDialogs";
import { Empty } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBookings, useEvents } from "@/lib/data";
import { EVENT_STATUS, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/eventi/")({
  head: () => ({
    meta: [
      { title: "Eventi — Mana Flask" },
      { name: "description", content: "Crea e gestisci gli eventi di Mana Flask." },
      { property: "og:title", content: "Eventi — Mana Flask" },
      { property: "og:description", content: "Crea e gestisci gli eventi di Mana Flask." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { data: events = [], isLoading } = useEvents();
  const { data: bookings = [] } = useBookings();
  const [open, setOpen] = useState(false);
  const count = (id: string) =>
    bookings.filter((b) => b.event_id === id && b.status !== "annullata").length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Eventi"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nuovo evento
          </Button>
        }
      />
      {!isLoading && !events.length && <Empty>Nessun evento. Crea il primo!</Empty>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link
            key={e.id}
            to="/eventi/$id"
            params={{ id: e.id }}
            className="rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-secondary">
                {fmtDate(e.event_date)}
              </div>
              <Badge variant={EVENT_STATUS[e.status].variant}>{EVENT_STATUS[e.status].label}</Badge>
            </div>
            <h3 className="mt-2 text-lg font-semibold">{e.name}</h3>
            {e.location && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {e.location}
              </p>
            )}
            <p className="mt-3 text-sm">
              <span className="font-semibold text-primary">{count(e.id)}</span> prenotazioni
            </p>
          </Link>
        ))}
      </div>
      <EventDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
