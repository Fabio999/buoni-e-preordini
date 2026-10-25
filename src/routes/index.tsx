import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { SectionLabel } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      delivered: active.filter((b) => b.status === "consegnata").length,
    };
  }, [events, bookings]);

  const bookingStats = [
    { label: "Totali", value: stats.total, dot: "bg-info" },
    { label: "Consegnate", value: stats.delivered, dot: "bg-primary" },
    { label: "Non pagate", value: stats.unpaid, dot: "bg-destructive" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Dashboard" />
      <PlanningSummary compact />

      <SectionLabel>Prossimo evento</SectionLabel>
      {stats.next ? (
        <Link
          to="/eventi/$id"
          params={{ id: stats.next.id }}
          className="group block border-y py-5 transition-colors hover:bg-accent/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-info/10 text-info"><CalendarDays className="size-6" /></span>
              <div className="min-w-0">
              <Badge variant="default">{EVENT_STATUS[stats.next.status].label}</Badge>
              <h3 className="mt-2 break-words text-xl font-semibold">{stats.next.name}</h3>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {fmtDate(stats.next.event_date)}
                </span>
                {stats.next.location && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="break-words">{stats.next.location}</span>
                  </span>
                )}
              </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <div className="text-right">
              <div className="font-display text-2xl font-semibold">
                {stats.nextCount}
              </div>
              <div className="text-xs text-muted-foreground">prenotazioni</div>
              </div>
              <ArrowUpRight className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
          </div>
        </Link>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-y py-5 text-sm text-muted-foreground">
          Nessun evento in programma.{" "}
          <Button asChild variant="ghost" size="sm"><Link to="/eventi">Eventi <ArrowUpRight /></Link></Button>
        </div>
      )}

      <SectionLabel>Prenotazioni</SectionLabel>
      <div className="grid grid-cols-3 divide-x divide-border rounded-lg border bg-card">
        {bookingStats.map((s) => (
          <div key={s.label} className="min-w-0 px-3 py-3 transition-colors hover:bg-muted/50 sm:px-5">
            <p className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />
              <span className="break-words">{s.label}</span>
            </p>
            <p className="mt-1 font-display text-lg font-semibold leading-tight tabular-nums">
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
