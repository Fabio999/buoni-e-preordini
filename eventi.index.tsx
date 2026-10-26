import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ChevronDown, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { EventDialog } from "@/components/forms/SimpleDialogs";
import { EventDot } from "@/components/planning/EventDot";
import { Empty, SectionLabel } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBookings, useCalendarEntries, useEvents } from "@/lib/data";
import { EVENT_STATUS, fmtDate } from "@/lib/format";
import {
  archivedEvents,
  eventsByMonth,
  planningDate,
  upcomingEvents,
  type CalendarEntry,
} from "@/lib/planning";

export const Route = createFileRoute("/eventi/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Eventi — Mana Flask" },
      { name: "description", content: "Crea e gestisci gli eventi di Mana Flask." },
      { property: "og:title", content: "Eventi — Mana Flask" },
      { property: "og:description", content: "Crea e gestisci gli eventi di Mana Flask." },
    ],
  }),
  component: EventsPage,
});

function CalendarEventList({ entries }: { entries: CalendarEntry[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card shadow-sm">
      {entries.map((e) => (
        <li key={e.id}>
          <Link
            to="/calendario"
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm transition hover:bg-muted/50"
          >
            <span className="flex min-w-0 items-center gap-2">
              <EventDot color={e.color} recurring={!!e.recurrence_series} />
              <span className="font-medium">{e.title}</span>
              {e.game && <span className="text-muted-foreground">· {e.game}</span>}
              {!e.confirmed && <Badge variant="outline">Da programmare</Badge>}
            </span>
            <span className="tabular-nums">{planningDate(e.starts_at, e.timezone)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EventsPage() {
  const { data: events = [], isLoading } = useEvents();
  const { data: bookings = [] } = useBookings();
  const { data: entries = [], isLoading: loadingEntries } = useCalendarEntries();
  const [open, setOpen] = useState(false);
  const count = (id: string) =>
    bookings.filter((b) => b.event_id === id && b.status !== "annullata").length;
  const now = new Date();
  const upcoming = upcomingEvents(entries, now);
  const archived = archivedEvents(entries, now);

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
      <SectionLabel>Prossimi eventi</SectionLabel>
      {loadingEntries ? (
        <Empty>Caricamento…</Empty>
      ) : upcoming.length ? (
        <div className="space-y-5">
          {eventsByMonth(upcoming).map((group) => (
            <section key={group.month} aria-label={group.label}>
              <h3 className="mb-2 flex items-baseline gap-2 font-display text-lg font-semibold">
                {group.label}
                <span className="text-sm font-normal text-muted-foreground">
                  {group.events.length} {group.events.length === 1 ? "evento" : "eventi"}
                </span>
              </h3>
              <CalendarEventList entries={group.events} />
            </section>
          ))}
        </div>
      ) : (
        <Empty>Nessun evento in programma nel calendario.</Empty>
      )}
      {!!archived.length && (
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Archive className="h-4 w-4" /> Archiviati ({archived.length})
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            <CalendarEventList entries={archived} />
          </div>
        </details>
      )}
      <SectionLabel>Eventi con prenotazioni</SectionLabel>
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
