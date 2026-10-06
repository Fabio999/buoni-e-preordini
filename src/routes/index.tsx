import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { SectionLabel, StatCard } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { balancesByClient, useBookings, useEvents, useMovements } from "@/lib/data";
import { EVENT_STATUS, euro, fmtDate } from "@/lib/format";

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
  const { data: movements } = useMovements();

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const next = [...events]
      .filter((e) => e.event_date >= today && e.status !== "concluso")
      .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
    const active = bookings.filter((b) => b.status !== "annullata");
    const bal = [...balancesByClient(movements).values()];
    return {
      next,
      nextCount: next ? active.filter((b) => b.event_id === next.id).length : 0,
      total: active.length,
      paid: active.filter((b) => b.payment_status === "pagato").length,
      unpaid: active.filter((b) => b.payment_status === "non_pagato").length,
      toPrepare: active.filter((b) => b.status === "da_preparare").length,
      ready: active.filter((b) => b.status === "pronta").length,
      withBalance: bal.filter((b) => b.balance > 0).length,
      available: bal.reduce((s, b) => s + b.balance, 0),
      loaded: bal.reduce((s, b) => s + b.loaded, 0),
      used: bal.reduce((s, b) => s + b.used, 0),
    };
  }, [events, bookings, movements]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Dashboard" subtitle="La situazione di oggi, a colpo d'occhio." />

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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Totali" value={stats.total} />
        <StatCard label="Pagate" value={stats.paid} tone="success" />
        <StatCard label="Non pagate" value={stats.unpaid} tone="danger" />
        <StatCard label="Da preparare" value={stats.toPrepare} tone="action" />
        <StatCard label="Pronte" value={stats.ready} tone="info" />
      </div>

      <SectionLabel>Saldo negozio</SectionLabel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Clienti con saldo" value={stats.withBalance} tone="info" />
        <StatCard label="Saldo disponibile" value={euro(stats.available)} tone="action" />
        <StatCard label="Totale caricato" value={euro(stats.loaded)} tone="success" />
        <StatCard label="Totale utilizzato" value={euro(stats.used)} tone="danger" />
      </div>
    </div>
  );
}
