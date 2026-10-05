import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { balancesByClient, errMsg, useClients, useMovements, useProducts, useRefresh } from "@/lib/data";
import { euro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field, selectClass } from "./SimpleDialogs";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; clientId?: string };

function useBalance(clientId: string) {
  const { data: movements } = useMovements();
  return useMemo(() => balancesByClient(movements).get(clientId)?.balance ?? 0, [movements, clientId]);
}

function ClientSelect({ value, onChange, fixed }: { value: string; onChange: (v: string) => void; fixed?: boolean }) {
  const { data: clients = [] } = useClients();
  return (
    <select required disabled={fixed} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Seleziona…</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.last_name} {c.first_name}
        </option>
      ))}
    </select>
  );
}

function Preview({ before, delta }: { before: number; delta: number }) {
  const after = before + delta;
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/50 p-3 text-center">
      <div>
        <div className="text-xs text-muted-foreground">Saldo disponibile</div>
        <div className="font-display text-lg font-semibold">{euro(before)}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{delta < 0 ? "Totale acquisto" : "Variazione"}</div>
        <div className={cn("font-display text-lg font-semibold", delta < 0 ? "text-destructive" : "text-success")}>
          {delta < 0 ? "−" : "+"}
          {euro(Math.abs(delta))}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Saldo dopo</div>
        <div className={cn("font-display text-lg font-semibold", after < 0 ? "text-destructive" : "text-secondary")}>{euro(after)}</div>
      </div>
    </div>
  );
}

export function TopUpDialog({ open, onOpenChange, clientId: fixedClient, mode = "ricarica" }: Props & { mode?: "ricarica" | "correzione" }) {
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [sign, setSign] = useState<1 | -1>(1);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  const before = useBalance(clientId);
  useEffect(() => {
    if (open) {
      setClientId(fixedClient ?? "");
      setAmount("");
      setSign(1);
      setDesc("");
    }
  }, [open, fixedClient]);
  const delta = (Number(amount) || 0) * (mode === "correzione" ? sign : 1);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!delta) return toast.error("Inserisci un importo");
    if (before + delta < 0) return toast.error("Il saldo non può diventare negativo");
    setBusy(true);
    const { error } = await supabase.rpc("add_balance_movement", {
      _client: clientId,
      _type: mode,
      _amount: delta,
      _description: desc || (mode === "ricarica" ? "Ricarica saldo" : "Correzione saldo"),
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(mode === "ricarica" ? "Saldo ricaricato" : "Correzione registrata");
    refresh();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "ricarica" ? "Ricarica saldo" : "Correzione saldo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Cliente">
            <ClientSelect value={clientId} onChange={setClientId} fixed={!!fixedClient} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "correzione" && (
              <Field label="Tipo">
                <select className={selectClass} value={sign} onChange={(e) => setSign(Number(e.target.value) as 1 | -1)}>
                  <option value={1}>Aggiungi (+)</option>
                  <option value={-1}>Togli (−)</option>
                </select>
              </Field>
            )}
            <Field label="Importo (€)">
              <Input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </Field>
          </div>
          <Field label="Descrizione">
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={mode === "ricarica" ? "Es. Ricarica in contanti" : "Motivo della correzione"} />
          </Field>
          {clientId && <Preview before={before} delta={delta} />}
          <DialogFooter>
            <Button type="submit" disabled={busy || !clientId}>
              Conferma
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PurchaseDialog({ open, onOpenChange, clientId: fixedClient }: Props) {
  const { data: products = [] } = useProducts();
  const [clientId, setClientId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  const before = useBalance(clientId);

  useEffect(() => {
    if (open) {
      setClientId(fixedClient ?? "");
      setProductId("");
      setQuantity(1);
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      setNotes("");
    }
  }, [open, fixedClient]);

  const product = products.find((p) => p.id === productId);
  const total = Number(amount) || 0;
  const insufficient = total > before;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product) return toast.error("Seleziona un prodotto");
    if (insufficient) return toast.error("Saldo insufficiente");
    setBusy(true);
    const { error } = await supabase.rpc("register_purchase", {
      _client: clientId,
      _product: product.id,
      _product_name: product.name,
      _quantity: quantity,
      _amount: total,
      _date: date,
      _notes: notes,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Acquisto registrato");
    refresh();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registra acquisto con saldo</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Cliente">
            <ClientSelect value={clientId} onChange={setClientId} fixed={!!fixedClient} />
          </Field>
          <Field label="Prodotto">
            <select
              required
              className={selectClass}
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                const p = products.find((x) => x.id === e.target.value);
                if (p) setAmount((Number(p.price) * quantity).toFixed(2));
              }}
            >
              <option value="">Seleziona…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({euro(p.price)})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Quantità">
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => {
                  const q = Math.max(1, Number(e.target.value));
                  setQuantity(q);
                  if (product) setAmount((Number(product.price) * q).toFixed(2));
                }}
              />
            </Field>
            <Field label="Importo (€)">
              <Input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Data">
              <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Note (opzionali)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {clientId && <Preview before={before} delta={-total} />}
          {clientId && insufficient && <p className="text-sm font-medium text-destructive">Saldo insufficiente per questo acquisto.</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy || !clientId || insufficient || total <= 0}>
              Conferma acquisto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
