import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { BookingsTable } from "@/components/BookingsTable";
import { BookingDialog } from "@/components/forms/BookingDialog";
import { EventDialog, selectClass } from "@/components/forms/SimpleDialogs";
import { Empty, Section, StatCard } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  bookingTotal,
  errMsg,
  useBookings,
  useChecklist,
  useEvents,
  useRefresh,
  type Booking,
} from "@/lib/data";
import { CHECKLIST_CATEGORIES, EVENT_STATUS, euro, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/eventi/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Dettaglio evento — Mana Flask" },
      {
        name: "description",
        content: "Riepilogo, prenotazioni, preparazione e checklist dell'evento.",
      },
      { property: "og:title", content: "Dettaglio evento — Mana Flask" },
      {
        property: "og:description",
        content: "Riepilogo, prenotazioni, preparazione e checklist dell'evento.",
      },
    ],
  }),
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: events, isLoading } = useEvents();
  const { data: allBookings = [] } = useBookings();
  const refresh = useRefresh();
  const [edit, setEdit] = useState(false);
  const [newBooking, setNewBooking] = useState(false);
  const event = events?.find((e) => e.id === id);
  const bookings = useMemo(() => allBookings.filter((b) => b.event_id === id), [allBookings, id]);
  const active = bookings.filter((b) => b.status !== "annullata");

  const summary = useMemo(() => {
    const paid = active.filter((b) => b.payment_status === "pagato");
    const unpaid = active.filter((b) => b.payment_status === "non_pagato");
    return {
      paid: paid.length,
      unpaid: unpaid.length,
      collected: paid.reduce((s, b) => s + bookingTotal(b), 0),
      toCollect: unpaid.reduce((s, b) => s + bookingTotal(b), 0),
    };
  }, [active]);

  if (isLoading) return null;
  if (!event) return <Empty>Evento non trovato</Empty>;

  const remove = async () => {
    if (!confirm("Eliminare l'evento? Verranno eliminate anche le sue prenotazioni e la checklist.")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    refresh();
    navigate({ to: "/eventi" });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        to="/eventi"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Eventi
      </Link>
      <PageHeader
        title={event.name}
        actions={
          <>
            <Button variant="outline" onClick={() => setEdit(true)}>
              <Pencil className="h-4 w-4" /> Modifica
            </Button>
            <Button variant="ghost" size="icon" onClick={remove} aria-label="Elimina evento">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <Badge variant={EVENT_STATUS[event.status].variant}>
          {EVENT_STATUS[event.status].label}
        </Badge>
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" />
          {fmtDate(event.event_date)}
        </span>
        {event.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {event.location}
          </span>
        )}
      </div>
      {event.notes && <p className="mb-6 rounded-lg border bg-card p-3 text-sm">{event.notes}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Prenotazioni" value={active.length} />
        <StatCard label="Pagate" value={summary.paid} tone="success" />
        <StatCard label="Non pagate" value={summary.unpaid} tone="danger" />
        <StatCard label="Incassato" value={euro(summary.collected)} tone="success" />
        <StatCard label="Da incassare" value={euro(summary.toCollect)} tone="danger" />
      </div>

      <Tabs defaultValue="prenotazioni">
        <TabsList className="mb-4">
          <TabsTrigger value="prenotazioni">Prenotazioni</TabsTrigger>
          <TabsTrigger value="preparazione">Preparazione</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>
        <TabsContent value="prenotazioni">
          <Section
            title={`Prenotazioni (${bookings.length})`}
            actions={
              <Button size="sm" onClick={() => setNewBooking(true)}>
                <Plus className="h-4 w-4" /> Nuova prenotazione
              </Button>
            }
          >
            <BookingsTable bookings={bookings} hide={["event"]} />
          </Section>
        </TabsContent>
        <TabsContent value="preparazione">
          <Preparation bookings={active} />
        </TabsContent>
        <TabsContent value="checklist">
          <Checklist eventId={id} />
        </TabsContent>
      </Tabs>

      <EventDialog open={edit} onOpenChange={setEdit} initial={event} />
      <BookingDialog open={newBooking} onOpenChange={setNewBooking} defaultEventId={id} />
    </div>
  );
}

function Preparation({ bookings }: { bookings: Booking[] }) {
  const rows = useMemo(() => {
    const map = new Map<
      string,
      { name: string; category: string; total: number; ready: number; toPrepare: number }
    >();
    for (const b of bookings) {
      for (const i of b.booking_items) {
        const r = map.get(i.product_id ?? i.product_name) ?? {
          name: i.products?.name ?? (i.product_name || "?"),
          category: i.products?.category ?? "",
          total: 0,
          ready: 0,
          toPrepare: 0,
        };
        r.total += i.quantity;
        if (b.status === "da_preparare") r.toPrepare += i.quantity;
        else r.ready += i.quantity;
        map.set(i.product_id ?? i.product_name, r);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [bookings]);
  const toPrepare = bookings.filter((b) => b.status === "da_preparare").length;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Section title="Prodotti da portare">
        {!rows.length ? (
          <Empty>Nessun prodotto prenotato</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Prodotto</th>
                  <th className="py-2 pr-3 text-right font-semibold">Totale</th>
                  <th className="py-2 pr-3 text-right font-semibold">Da preparare</th>
                  <th className="py-2 text-right font-semibold">Preparati</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{r.name}</div>
                      {r.category && (
                        <div className="text-xs text-muted-foreground">{r.category}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-display text-base font-semibold">
                      {r.total}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pr-3 text-right font-semibold",
                        r.toPrepare ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {r.toPrepare}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-success">{r.ready}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <div className="grid content-start gap-3">
        <StatCard label="Prenotazioni da preparare" value={toPrepare} tone="action" />
        <StatCard label="Pronte / consegnate" value={bookings.length - toPrepare} tone="success" />
        <StatCard
          label="Pagate"
          value={bookings.filter((b) => b.payment_status === "pagato").length}
          tone="success"
        />
        <StatCard
          label="Non pagate"
          value={bookings.filter((b) => b.payment_status === "non_pagato").length}
          tone="danger"
        />
      </div>
    </div>
  );
}

function Checklist({ eventId }: { eventId: string }) {
  const { data: items = [] } = useChecklist(eventId);
  const refresh = useRefresh();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string>("Prodotti");

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    const { error } = await supabase
      .from("checklist_items")
      .insert({ event_id: eventId, label: label.trim(), category });
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    setLabel("");
    refresh();
  };
  const toggle = async (id: string, done: boolean) => {
    await supabase.from("checklist_items").update({ done }).eq("id", id);
    refresh();
  };
  const rename = async (id: string, current: string) => {
    const next = prompt("Modifica voce", current)?.trim();
    if (!next || next === current) return;
    const { error } = await supabase.from("checklist_items").update({ label: next }).eq("id", id);
    if (error) toast.error(errMsg(error));
    refresh();
  };
  const remove = async (id: string) => {
    await supabase.from("checklist_items").delete().eq("id", id);
    refresh();
  };
  const done = items.filter((i) => i.done).length;
  const grouped = CHECKLIST_CATEGORIES.map((c) => ({
    c,
    list: items.filter((i) => i.category === c),
  })).filter((g) => g.list.length);

  return (
    <Section title={`Checklist (${done}/${items.length} preparati)`}>
      <form onSubmit={add} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <select
          className={cn(selectClass, "sm:w-56")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CHECKLIST_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Es. Tovaglia stand, POS carico…"
        />
        <Button type="submit">
          <Plus className="h-4 w-4" /> Aggiungi
        </Button>
      </form>
      {!items.length && <Empty>Nessuna voce in checklist</Empty>}
      <div className="space-y-4">
        {grouped.map((g) => (
          <div key={g.c}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-secondary">
              {g.c}
            </div>
            <ul className="divide-y rounded-lg border">
              {g.list.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox checked={i.done} onCheckedChange={(v) => toggle(i.id, !!v)} id={i.id} />
                  <label
                    htmlFor={i.id}
                    className={cn(
                      "flex-1 cursor-pointer text-sm",
                      i.done && "text-muted-foreground line-through",
                    )}
                  >
                    {i.label}
                  </label>
                  <Badge variant={i.done ? "success" : "action"}>
                    {i.done ? "Preparato" : "Da preparare"}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => rename(i.id, i.label)}
                    aria-label="Modifica voce"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(i.id)}
                    aria-label="Rimuovi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
