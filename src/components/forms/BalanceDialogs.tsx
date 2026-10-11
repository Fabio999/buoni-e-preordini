import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Plus } from "lucide-react";
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
import {
  balancesByClient,
  errMsg,
  useMovements,
  useProducts,
  useRefresh,
} from "@/lib/data";
import { euro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field, selectClass } from "./SimpleDialogs";
import { ClientSelect } from "./ClientSelect";
import { ProductSelect } from "./EntitySelect";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; clientId?: string | undefined };

function useBalance(clientId: string) {
  const { data: movements } = useMovements();
  return useMemo(
    () => balancesByClient(movements).get(clientId)?.balance ?? 0,
    [movements, clientId],
  );
}

function Preview({ before, delta, kind = "ricarica" }: { before: number; delta: number; kind?: "ricarica" | "correzione" | "acquisto" }) {
  const after = before + delta;
  return (
    <div aria-live="polite" className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/50 p-4 sm:grid-cols-3 sm:text-center">
      <div>
        <div className="text-xs text-muted-foreground">Buono attuale</div>
        <div className="font-display text-lg font-semibold">{euro(before)}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">
          {kind === "acquisto" ? "Da scalare" : kind === "ricarica" ? "Ricarica" : "Correzione"}
        </div>
        <div
          className={cn(
            "font-display text-lg font-semibold",
            delta < 0 ? "text-destructive" : "text-success",
          )}
        >
          {delta < 0 ? "−" : "+"}
          {euro(Math.abs(delta))}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Buono dopo l’operazione</div>
        <div
          className={cn(
            "font-display text-lg font-semibold",
            after < 0 ? "text-destructive" : "text-secondary",
          )}
        >
          {euro(after)}
        </div>
      </div>
    </div>
  );
}

export function TopUpDialog({
  open,
  onOpenChange,
  clientId: fixedClient,
  mode = "ricarica",
}: Props & { mode?: "ricarica" | "correzione" }) {
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
    if (!delta) {
      toast.error("Inserisci un importo");
      return;
    }
    if (before + delta < 0) {
      toast.error("Il saldo non può diventare negativo");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("add_balance_movement", {
      _client: clientId,
      _type: mode,
      _amount: delta,
      _description: desc || (mode === "ricarica" ? "Ricarica saldo" : "Correzione saldo"),
    });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success(mode === "ricarica" ? `Buono ricaricato di ${euro(delta)}` : "Correzione registrata");
    refresh();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "ricarica" ? "Ricarica buono negozio" : "Correggi buono negozio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Cliente">
            <ClientSelect value={clientId} onChange={setClientId} fixed={!!fixedClient} />
          </Field>
          <div className={cn("grid gap-4", mode === "correzione" && "sm:grid-cols-2")}>
            {mode === "correzione" && (
              <Field label="Tipo">
                <select
                  className={selectClass}
                  value={sign}
                  onChange={(e) => setSign(Number(e.target.value) as 1 | -1)}
                >
                  <option value={1}>Aggiungi (+)</option>
                  <option value={-1}>Togli (−)</option>
                </select>
              </Field>
            )}
            <Field label={mode === "ricarica" ? "Importo da aggiungere (€)" : "Importo della correzione (€)"}>
              <Input
                aria-label={mode === "ricarica" ? "Importo da aggiungere" : "Importo della correzione"}
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
              {mode === "ricarica" && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[10, 20, 50, 100].map((value) => (
                    <Button key={value} type="button" size="sm" variant={Number(amount) === value ? "secondary" : "outline"}
                      aria-pressed={Number(amount) === value} onClick={() => setAmount(String(value))}>
                      {value} €
                    </Button>
                  ))}
                </div>
              )}
            </Field>
          </div>
          <Field label="Descrizione (facoltativa)">
            <Input
              aria-label="Descrizione"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={
                mode === "ricarica" ? "Es. Ricarica in contanti" : "Motivo della correzione"
              }
            />
          </Field>
          {clientId && <Preview before={before} delta={delta} kind={mode} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
            <Button type="submit" disabled={busy || !clientId || !delta || before + delta < 0}>
              <Plus className="h-4 w-4" />
              {busy ? "Salvataggio…" : mode === "ricarica" ? "Conferma ricarica" : "Conferma correzione"}
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
    if (!product) {
      toast.error("Seleziona un prodotto");
      return;
    }
    if (insufficient) {
      toast.error("Saldo insufficiente");
      return;
    }
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
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("Acquisto registrato");
    refresh();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Usa buono per un acquisto</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Cliente">
            <ClientSelect value={clientId} onChange={setClientId} fixed={!!fixedClient} />
          </Field>
          <Field label="Prodotto">
            <ProductSelect
              value={productId}
              onChange={(id, product) => {
                setProductId(id);
                setAmount(product ? (Number(product.price) * quantity).toFixed(2) : "");
              }}
            />
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
              <Input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Data">
              <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Note (opzionali)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {clientId && <Preview before={before} delta={-total} kind="acquisto" />}
          {clientId && insufficient && (
            <p className="text-sm font-medium text-destructive">
              Il buono non copre questo acquisto. Mancano {euro(total - before)}.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
            <Button type="submit" disabled={busy || !clientId || insufficient || total <= 0}>
              <ArrowRight className="h-4 w-4" /> {busy ? "Salvataggio…" : "Conferma utilizzo buono"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
