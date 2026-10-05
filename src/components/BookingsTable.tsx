import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { bookingTotal, errMsg, useRefresh, type Booking } from "@/lib/data";
import { BOOKING_STATUS, euro, fmtDate, fullName, type BookingStatus } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BookingDialog } from "./forms/BookingDialog";
import { Empty, PaymentPill } from "./Status";

const statusTone: Record<BookingStatus, string> = {
  da_preparare: "bg-primary/15 text-primary",
  pronta: "bg-info/15 text-info",
  consegnata: "bg-success/15 text-success",
  annullata: "bg-muted text-muted-foreground",
};

export function useBookingActions() {
  const refresh = useRefresh();
  return {
    togglePayment: async (b: Booking) => {
      const next = b.payment_status === "pagato" ? "non_pagato" : "pagato";
      const { error } = await supabase.from("bookings").update({ payment_status: next }).eq("id", b.id);
      if (error) return toast.error(errMsg(error));
      refresh();
    },
    setStatus: async (b: Booking, status: BookingStatus) => {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", b.id);
      if (error) return toast.error(errMsg(error));
      refresh();
    },
    remove: async (b: Booking) => {
      if (!confirm("Eliminare questa prenotazione?")) return;
      const { error } = await supabase.from("bookings").delete().eq("id", b.id);
      if (error) return toast.error(errMsg(error));
      toast.success("Prenotazione eliminata");
      refresh();
    },
  };
}

function StatusSelect({ b, onChange }: { b: Booking; onChange: (s: BookingStatus) => void }) {
  return (
    <select
      value={b.status}
      onChange={(e) => onChange(e.target.value as BookingStatus)}
      className={cn("cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-semibold focus:ring-2 focus:ring-ring", statusTone[b.status])}
    >
      {Object.entries(BOOKING_STATUS).map(([k, v]) => (
        <option key={k} value={k}>
          {v.label}
        </option>
      ))}
    </select>
  );
}

const itemsText = (b: Booking) => b.booking_items.map((i) => `${i.quantity}× ${i.products?.name ?? "?"}`).join(", ");

export function BookingsTable({ bookings, hide = [] }: { bookings: Booking[]; hide?: ("client" | "event")[] }) {
  const [editing, setEditing] = useState<Booking | null>(null);
  const a = useBookingActions();
  if (!bookings.length) return <Empty>Nessuna prenotazione</Empty>;
  const showClient = !hide.includes("client");
  const showEvent = !hide.includes("event");

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Pagamento</th>
              {showClient && <th className="py-2 pr-3 font-semibold">Cliente</th>}
              {showEvent && <th className="py-2 pr-3 font-semibold">Evento</th>}
              <th className="py-2 pr-3 font-semibold">Prodotti</th>
              <th className="py-2 pr-3 text-right font-semibold">Totale</th>
              <th className="py-2 pr-3 font-semibold">Stato</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="py-2.5 pr-3">
                  <PaymentPill status={b.payment_status} onClick={() => a.togglePayment(b)} />
                </td>
                {showClient && (
                  <td className="py-2.5 pr-3 font-medium">
                    {b.clients ? (
                      <Link to="/clienti/$id" params={{ id: b.clients.id }} className="hover:text-primary">
                        {fullName(b.clients)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {showEvent && (
                  <td className="py-2.5 pr-3">
                    {b.events ? (
                      <Link to="/eventi/$id" params={{ id: b.events.id }} className="hover:text-primary">
                        {b.events.name}
                        <span className="block text-xs text-muted-foreground">{fmtDate(b.events.event_date)}</span>
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="max-w-xs py-2.5 pr-3 text-muted-foreground">{itemsText(b)}</td>
                <td className="py-2.5 pr-3 text-right font-semibold">{euro(bookingTotal(b))}</td>
                <td className="py-2.5 pr-3">
                  <StatusSelect b={b} onChange={(s) => a.setStatus(b, s)} />
                </td>
                <td className="whitespace-nowrap py-2.5 text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(b)} aria-label="Modifica">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => a.remove(b)} aria-label="Elimina">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {bookings.map((b) => (
          <div
            key={b.id}
            className={cn("rounded-lg border border-l-4 bg-card p-3", b.payment_status === "pagato" ? "border-l-success" : "border-l-destructive")}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                {showClient && <div className="font-semibold">{fullName(b.clients)}</div>}
                {showEvent && <div className="text-xs text-muted-foreground">{b.events?.name} · {fmtDate(b.events?.event_date)}</div>}
              </div>
              <div className="font-display font-semibold">{euro(bookingTotal(b))}</div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{itemsText(b)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PaymentPill status={b.payment_status} onClick={() => a.togglePayment(b)} />
              <StatusSelect b={b} onChange={(s) => a.setStatus(b, s)} />
              <div className="ml-auto">
                <Button size="icon" variant="ghost" onClick={() => setEditing(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => a.remove(b)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <BookingDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing} />
    </>
  );
}
