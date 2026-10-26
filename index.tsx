import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { it } from "date-fns/locale";
import { useMemo, type ReactNode } from "react";
import { PageHeader } from "@/components/AppShell";
import { EventDot } from "@/components/planning/EventDot";
import { Badge } from "@/components/ui/badge";
import { useBookings, useCalendarEntries, useEvents, useTasks } from "@/lib/data";
import { EVENT_STATUS, fmtDate } from "@/lib/format";
import { dayLabel, taskStats, upcomingEvents, ZONE } from "@/lib/planning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Dashboard — Mana Flask" },
      {
        name: "description",
        content: "Panoramica di prossimi eventi, prenotazioni e task di Mana Flask.",
      },
      { property: "og:title", content: "Dashboard — Mana Flask" },
      {
        property: "og:description",
        content: "Panoramica di prossimi eventi, prenotazioni e task di Mana Flask.",
      },
    ],
  }),
  component: Dashboard,
});

function Panel({
  title,
  link,
  children,
  className,
}: {
  title: string;
  link: { to: "/eventi" | "/prenotazioni" | "/task-calendario"; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <Link
          to={link.to}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {link.label} <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Counter({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  const active = alert && value > 0;
  return (
    <div className={cn("rounded-lg px-3 py-3", active ? "bg-destructive/10" : "bg-muted/50")}>
      <p
        className={cn(
          "font-display text-3xl font-semibold leading-none tabular-nums",
          active ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Dashboard() {
  const { data: events = [] } = useEvents();
  const { data: bookings = [] } = useBookings();
  const { data: entries = [], isLoading: loadingEntries } = useCalendarEntries();
  const { data: tasks = [] } = useTasks();
  const now = new Date();
  const todayLabel = formatInTimeZone(now, ZONE, "EEEE d MMMM yyyy", { locale: it });
  const nextEntries = upcomingEvents(entries, now).slice(0, 6);
  const t = taskStats(tasks, now);

  const stats = useMemo(() => {
    const today = formatInTimeZone(new Date(), ZONE, "yyyy-MM-dd");
    const next = [...events]
      .filter((e) => e.event_date >= today && e.status !== "concluso")
      .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
    const active = bookings.filter((b) => b.status !== "annullata");
    return {
      next,
      nextCount: next ? active.filter((b) => b.event_id === next.id).length : 0,
      total: active.length,
      toDeliver: active.filter((b) => b.status !== "consegnata").length,
      unpaid: active.filter((b) => b.payment_status === "non_pagato").length,
    };
  }, [events, bookings]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
      />

      <Panel title="Prossimi appuntamenti" link={{ to: "/eventi", label: "Tutti gli eventi" }}>
        {loadingEntries ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Caricamento…</p>
        ) : nextEntries.length ? (
          <ul className="divide-y">
            {nextEntries.map((e) => {
              const day = dayLabel(e.starts_at, now);
              return (
                <li key={e.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-20 shrink-0 text-center">
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wide",
                        day === "Oggi" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {day}
                    </p>
                    <p className="font-display text-lg font-semibold tabular-nums">
                      {formatInTimeZone(e.starts_at, ZONE, "HH:mm")}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    <EventDot color={e.color} recurring={!!e.recurrence_series} />
                    <span className="font-medium">{e.title}</span>
                    {e.game && <span className="text-sm text-muted-foreground">{e.game}</span>}
                    {!e.confirmed && <Badge variant="outline">Da programmare</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nessun appuntamento in programma.
          </p>
        )}
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Prenotazioni" link={{ to: "/prenotazioni", label: "Apri" }}>
          <div className="grid grid-cols-2 gap-3 p-4">
            <Counter label="Da consegnare" value={stats.toDeliver} alert />
            <Counter label="Non pagate" value={stats.unpaid} alert />
          </div>
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            {stats.total} prenotazioni attive in totale
          </p>
        </Panel>

        <Panel title="Task" link={{ to: "/task-calendario", label: "Apri" }}>
          <div className="grid grid-cols-3 gap-3 p-4">
            <Counter label="Aperte" value={t.todo} />
            <Counter label="In corso" value={t.progress} />
            <Counter label="Completate" value={t.done} />
          </div>
        </Panel>
      </div>

      {stats.next && (
        <Link
          to="/eventi/$id"
          params={{ id: stats.next.id }}
          className="group flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-4 py-4 shadow-sm transition hover:border-primary"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prossimo evento con prenotazioni
              </p>
              <p className="font-semibold">{stats.next.name}</p>
              <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                <span>{fmtDate(stats.next.event_date)}</span>
                {stats.next.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {stats.next.location}
                  </span>
                )}
                <span>{EVENT_STATUS[stats.next.status].label}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold">{stats.nextCount}</p>
            <p className="text-xs text-muted-foreground">prenotazioni</p>
          </div>
        </Link>
      )}
    </div>
  );
}
