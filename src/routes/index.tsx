import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { SectionLabel } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { useBookings, useEvents } from "@/lib/data";
import { EVENT_STATUS, fmtDate } from "@/lib/format";
import { PlanningSummary } from "@/components/planning/PlanningSummary";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Dashboard — Mana Flask" },
      {
        name: "description",
        content: "Panoramica di eventi, prenotazioni e saldo negozio di Mana Flask.",
      },
      { property: "og:title", content: "Dashboard — Mana Flask" },
      {
        property: "og:description",
        content: "Panoramica di eventi, prenotazioni e saldo negozio di Mana Flask.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: events = [] } = useEvents();
  const { data: bookings = [] } = useBookings();

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const next = [...events]
      .filter((e) => e.event_date >= today && e.status !== "concluso")
      .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
    const active = bookings.filter((b) => b.status !== "annullata");
    return {
      next,
      nextCount: next ? active.filter((b) => b.event_id === next.id).length : 0,
      total: active.length,
      unpaid: active.filter((b) => b.payment_status === "non_pagato").length,
      deliveredUnpaid: active.filter(
        (b) => b.status === "consegnata" && b.payment_status === "non_pagato",
      ).length,
    };
  }, [events, bookings]);

  const bookingStats = [
    { label: "Totali", value: stats.total, dot: "bg-info" },
    { label: "Non pagate", value: stats.unpaid, dot: "bg-destructive" },
    { label: "Consegnate da pagare", value: stats.deliveredUnpaid, dot: "bg-primary" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Dashboard" subtitle="La situazione di oggi, a colpo d'occhio." />
      <PlanningSummary />

      <SectionLabel>Prossimo evento</SectionLabel>
      {stats.next ? (
        <Link
          to="/eventi/$id"
          params={{ id: stats.next.id }}
          className="block rounded-xl bg-secondary p-5 text-secondary-foreground shadow-sm transition hover:shadow-md md:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge variant="default">{EVENT_STATUS[stats.next.status].label}</Badge>
              <h3 className="mt-3 text-2xl font-semibold md:text-3xl">{stats.next.name}</h3>
              <div className="mt-2 flex flex-wrap gap-4 text-sm opacity-85">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {fmtDate(stats.next.event_date)}
                </span>
                {stats.next.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {stats.next.location}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-4xl font-semibold text-primary">
                {stats.nextCount}
              </div>
              <div className="text-sm opacity-85">prenotazioni</div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          Nessun evento in programma.{" "}
          <Link to="/eventi" className="font-medium text-primary">
            Crea un evento
          </Link>
        </div>
      )}

      <SectionLabel>Prenotazioni</SectionLabel>
      <div className="grid divide-y divide-border rounded-xl border bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {bookingStats.map((s) => (
          <div
            key={s.label}
            className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-secondary/40"
          >
            <span className={cn("mt-1 size-2 shrink-0 rounded-full", s.dot)} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
              <p className="font-display text-lg font-semibold leading-tight tabular-nums">
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
