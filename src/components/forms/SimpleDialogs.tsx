import { useEffect, useState, type FormEvent, type ReactNode } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useRefresh, type Client, type EventRow, type Product } from "@/lib/data";
import { EVENT_STATUS, type EventStatus } from "@/lib/format";

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);

export const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type DialogProps<T> = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: T | null;
  onSaved?: (id: string) => void;
};

export function ClientDialog({ open, onOpenChange, initial, onSaved }: DialogProps<Client>) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const refresh = useRefresh();
  useEffect(() => {
    if (open) {
      setFirst(initial?.first_name ?? "");
      setLast(initial?.last_name ?? "");
    }
  }, [open, initial]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const row = { first_name: first.trim(), last_name: last.trim() };
    const res = initial
      ? await supabase.from("clients").update(row).eq("id", initial.id).select("id").single()
      : await supabase.from("clients").insert(row).select("id").single();
    if (res.error) {
      toast.error(errMsg(res.error));
      return;
    }
    toast.success(initial ? "Cliente aggiornato" : "Cliente creato");
    await refresh();
    onSaved?.(res.data.id);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Modifica cliente" : "Nuovo cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <Input required aria-label="Nome" value={first} onChange={(e) => setFirst(e.target.value)} autoFocus />
            </Field>
            <Field label="Cognome">
              <Input required aria-label="Cognome" value={last} onChange={(e) => setLast(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit">Salva</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductDialog({ open, onOpenChange, initial, onSaved }: Omit<DialogProps<Product>, "onSaved"> & { onSaved?: (id: string, product: Product) => void }) {
  const [f, setF] = useState({ name: "", price: "", category: "", sku: "", game: "", product_type: "" });
  const refresh = useRefresh();
  useEffect(() => {
    if (open)
      setF({
        name: initial?.name ?? "",
        price: initial ? String(initial.price) : "",
        category: initial?.category ?? "",
        sku: initial?.sku ?? "",
        game: initial?.game ?? "",
        product_type: initial?.product_type ?? "",
      });
  }, [open, initial]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const row = {
      name: f.name.trim(),
      price: Number(f.price),
      category: f.category.trim(),
      sku: f.sku.trim() || null,
      game: f.game.trim(),
      product_type: f.product_type.trim(),
    };
    const res = initial
      ? await supabase.from("products").update(row).eq("id", initial.id).select("*").single()
      : await supabase.from("products").insert(row).select("*").single();
    if (res.error) {
      toast.error(errMsg(res.error));
      return;
    }
    toast.success("Prodotto salvato");
    await refresh();
    onSaved?.(res.data.id, res.data);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Modifica prodotto" : "Nuovo prodotto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <Input required aria-label="Nome prodotto" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gioco">
              <Input
                value={f.game}
                aria-label="Gioco"
                onChange={(e) => setF({ ...f, game: e.target.value })}
                placeholder="Es. Magic, Riftbound, Pokémon"
              />
            </Field>
            <Field label="Tipo di prodotto">
              <Input
                value={f.product_type}
                aria-label="Tipo di prodotto"
                onChange={(e) => setF({ ...f, product_type: e.target.value })}
                placeholder="Es. Structure, Box, Vault"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prezzo (€)">
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={f.price}
                aria-label="Prezzo (€)"
                onChange={(e) => setF({ ...f, price: e.target.value })}
              />
            </Field>
            <Field label="Categoria">
              <Input
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value })}
              />
            </Field>
            <Field label="Codice / SKU">
              <Input
                value={f.sku}
                onChange={(e) => setF({ ...f, sku: e.target.value })}
                placeholder="Opzionale"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit">Salva</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EventDialog({ open, onOpenChange, initial, onSaved }: DialogProps<EventRow>) {
  const [f, setF] = useState({
    name: "",
    event_date: "",
    location: "",
    notes: "",
    status: "programmato" as EventStatus,
  });
  const refresh = useRefresh();
  useEffect(() => {
    if (open)
      setF({
        name: initial?.name ?? "",
        event_date: initial?.event_date ?? "",
        location: initial?.location ?? "",
        notes: initial?.notes ?? "",
        status: initial?.status ?? "programmato",
      });
  }, [open, initial]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = initial
      ? await supabase.from("events").update(f).eq("id", initial.id).select("id").single()
      : await supabase.from("events").insert(f).select("id").single();
    if (res.error) {
      toast.error(errMsg(res.error));
      return;
    }
    toast.success("Evento salvato");
    await refresh();
    onSaved?.(res.data.id);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Modifica evento" : "Nuovo evento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome evento">
            <Input required aria-label="Nome evento" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data">
              <Input
                required
                type="date"
                aria-label="Data evento"
                value={f.event_date}
                onChange={(e) => setF({ ...f, event_date: e.target.value })}
              />
            </Field>
            <Field label="Stato">
              <select
                className={selectClass}
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value as EventStatus })}
              >
                {Object.entries(EVENT_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Luogo">
            <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </Field>
          <Field label="Note">
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <DialogFooter>
            <Button type="submit">Salva</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
