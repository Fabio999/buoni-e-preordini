import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useEvents, useProducts, useRefresh, type Booking } from "@/lib/data";
import {
  BOOKING_STATUS,
  euro,
  fmtDate,
  type BookingStatus,
  type PaymentStatus,
} from "@/lib/format";
import { Field, selectClass } from "./SimpleDialogs";
import { ClientSelect } from "./ClientSelect";

type Line = { product_id: string; quantity: number; unit_price: number };

export function BookingDialog({
  open,
  onOpenChange,
  initial,
  defaultEventId,
  defaultClientId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Booking | null;
  defaultEventId?: string | undefined;
  defaultClientId?: string | undefined;
}) {
  const { data: events = [] } = useEvents();
  const { data: products = [] } = useProducts();
  const refresh = useRefresh();
  const [clientId, setClientId] = useState("");
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState<BookingStatus>("da_preparare");
  const [payment, setPayment] = useState<PaymentStatus>("non_pagato");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(initial?.client_id ?? defaultClientId ?? "");
    setEventId(initial?.event_id ?? defaultEventId ?? "");
    setStatus(initial?.status ?? "da_preparare");
    setPayment(initial?.payment_status ?? "non_pagato");
    setNotes(initial?.notes ?? "");
    setLines(
      initial?.booking_items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
      })) ?? [{ product_id: "", quantity: 1, unit_price: 0 }],
    );
  }, [open, initial, defaultEventId, defaultClientId]);

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const valid = lines.filter((l) => l.product_id && l.quantity > 0);
    if (!clientId || !eventId) {
      toast.error("Seleziona cliente ed evento");
      return;
    }
    if (!valid.length) {
      toast.error("Aggiungi almeno un prodotto");
      return;
    }
    setBusy(true);
    try {
      const row = {
        client_id: clientId,
        event_id: eventId,
        status,
        payment_status: payment,
        notes,
      };
      let id = initial?.id;
      if (id) {
        const r = await supabase.from("bookings").update(row).eq("id", id);
        if (r.error) throw r.error;
        const d = await supabase.from("booking_items").delete().eq("booking_id", id);
        if (d.error) throw d.error;
      } else {
        const r = await supabase.from("bookings").insert(row).select("id").single();
        if (r.error) throw r.error;
        id = r.data.id;
      }
      if (!id) throw new Error("Prenotazione non creata");
      const ins = await supabase
        .from("booking_items")
        .insert(valid.map((l) => ({ ...l, booking_id: id })));
      if (ins.error) throw ins.error;
      toast.success(initial ? "Prenotazione aggiornata" : "Prenotazione creata");
      refresh();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Modifica prenotazione" : "Nuova prenotazione"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              <ClientSelect value={clientId} onChange={setClientId} />
            </Field>
            <Field label="Evento">
              <select
                required
                className={selectClass}
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">Seleziona…</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} — {fmtDate(ev.event_date)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Prodotti</div>
            {lines.map((l, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_80px_110px_100px_auto] sm:items-center sm:border-0 sm:p-0"
              >
                <select
                  className={`${selectClass} col-span-2 sm:col-span-1`}
                  value={l.product_id}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setLine(i, { product_id: e.target.value, unit_price: p ? Number(p.price) : 0 });
                  }}
                >
                  <option value="">Prodotto…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({euro(p.price)})
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  value={l.quantity}
                  onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value)) })}
                  aria-label="Quantità"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={l.unit_price}
                  onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })}
                  aria-label="Prezzo"
                />
                <div className="text-right text-sm font-semibold">
                  {euro(l.quantity * l.unit_price)}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  disabled={lines.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="hidden px-1 text-xs text-muted-foreground sm:grid sm:grid-cols-[1fr_80px_110px_100px_auto] sm:gap-2">
              <span />
              <span>Quantità</span>
              <span>Prezzo unit.</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((ls) => [...ls, { product_id: "", quantity: 1, unit_price: 0 }])
              }
            >
              <Plus className="h-4 w-4" /> Aggiungi prodotto
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3 text-secondary-foreground">
            <span className="text-sm font-medium">Totale</span>
            <span className="font-display text-xl font-semibold">{euro(total)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stato prenotazione">
              <select
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
              >
                {Object.entries(BOOKING_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stato pagamento">
              <select
                className={selectClass}
                value={payment}
                onChange={(e) => setPayment(e.target.value as PaymentStatus)}
              >
                <option value="non_pagato">NON PAGATO</option>
                <option value="pagato">PAGATO</option>
              </select>
            </Field>
          </div>
          <Field label="Note">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              Salva prenotazione
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
