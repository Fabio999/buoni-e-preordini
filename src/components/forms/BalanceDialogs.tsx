import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Plus, ShoppingBag } from "lucide-react";
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
  saleSplit,
  useMovements,
  useProducts,
  useRefresh,
} from "@/lib/data";
import { euro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field, selectClass } from "./SimpleDialogs";
import { ClientSelect } from "./ClientSelect";
import { ProductSelect } from "./EntitySelect";
import { enqueue, isNetworkError, isOffline, pendingDelta, useQueue } from "@/lib/offline";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; clientId?: string | undefined };

function useBalance(clientId: string) {
  const { data: movements } = useMovements();
  const queue = useQueue();
  return useMemo(
    () => (balancesByClient(movements).get(clientId)?.balance ?? 0) + pendingDelta(queue, clientId),
    [movements, clientId, queue],
  );
}

/** Runs the voucher RPC; when there is no connection the operation is queued and sent later. */
async function runOrQueue(
  kind: "add_balance_movement" | "register_purchase" | "register_sale",
  client: string,
  delta: number,
  args: Record<string, unknown>,
): Promise<{ error: { message: string } | null; queued: boolean }> {
  if (!isOffline()) {
    const { error } = await supabase.rpc(kind, args as never);
    if (!isNetworkError(error)) return { error, queued: false };
  }
  enqueue({ kind, client, delta, args });
  return { error: null, queued: true };
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
    const { error, queued } = await runOrQueue("add_balance_movement", clientId, delta, {
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
    if (queued) toast.success("Senza connessione: operazione salvata, verrà inviata appena torna internet");
    else toast.success(mode === "ricarica" ? `Buono ricaricato di ${euro(delta)}` : "Correzione registrata");
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
    const { error, queued } = await runOrQueue("register_purchase", clientId, -total, {
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
    toast.success(queued ? "Senza connessione: acquisto salvato, verrà inviato appena torna internet" : "Acquisto registrato");
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

/**
 * Product sale with optional buono discount: one confirmation registers the
 * sale and the buono movement together, and the buono can never go negative.
 */
export function SaleDialog({
  open,
  onOpenChange,
  clientId: fixedClient,
  productId: fixedProduct,
}: Props & { productId?: string | undefined }) {
  const { data: products = [] } = useProducts();
  const [clientId, setClientId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState("");
  const [useBuono, setUseBuono] = useState(true);
  const [buonoAmount, setBuonoAmount] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  const before = useBalance(clientId);

  useEffect(() => {
    if (open) {
      setClientId(fixedClient ?? "");
      setProductId(fixedProduct ?? "");
      setQuantity(1);
      setAmount("");
      setUseBuono(true);
      setDate(new Date().toISOString().slice(0, 10));
      setNotes("");
    }
  }, [open, fixedClient, fixedProduct]);

  const product = products.find((p) => p.id === productId);
  const total = Number(amount) || 0;

  // Pre-fill the buono field with the most useful amount: all that is needed.
  useEffect(() => {
    if (useBuono) setBuonoAmount(Math.min(Math.max(0, before), total).toFixed(2));
  }, [useBuono, before, total, clientId, productId, quantity]);

  const split = saleSplit(total, before, useBuono ? Number(buonoAmount) || 0 : 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientId || !product) {
      toast.error("Seleziona cliente e prodotto");
      return;
    }
    if (total <= 0) {
      toast.error("Inserisci un importo");
      return;
    }
    setBusy(true);
    const { error, queued } = await runOrQueue("register_sale", clientId, -split.used, {
      _client: clientId,
      _product: product.id,
      _product_name: product.name,
      _quantity: quantity,
      _amount: total,
      _buono_used: split.used,
      _date: date,
      _notes: notes,
    });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success(
      queued
        ? "Senza connessione: vendita salvata, verrà inviata appena torna internet"
        : split.used > 0
          ? `Vendita registrata: ${euro(split.used)} scalati dal buono`
          : "Vendita registrata",
    );
    refresh();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vendita prodotto</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Cliente">
            <ClientSelect value={clientId} onChange={setClientId} fixed={!!fixedClient} />
          </Field>
          <Field label="Prodotto">
            <ProductSelect
              value={productId}
              onChange={(id, p) => {
                setProductId(id);
                setAmount(p ? (Number(p.price) * quantity).toFixed(2) : "");
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
            <Field label="Prezzo totale (€)">
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

          {clientId && (
            <div className="space-y-3 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={useBuono && before > 0}
                  disabled={before <= 0}
                  onChange={(e) => setUseBuono(e.target.checked)}
                />
                Usa il buono del cliente
                <span className="font-normal text-muted-foreground">
                  {before > 0 ? `(disponibili ${euro(before)})` : "(nessun buono disponibile)"}
                </span>
              </label>
              {useBuono && before > 0 && (
                <Field label="Buono da usare (€)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={buonoAmount}
                    onChange={(e) => setBuonoAmount(e.target.value)}
                    aria-label="Buono da usare"
                  />
                </Field>
              )}
            </div>
          )}

          <Field label="Note (opzionali)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {clientId && total > 0 && (
            <div
              aria-live="polite"
              className="space-y-2 rounded-lg bg-secondary px-4 py-3 text-secondary-foreground"
            >
              <div className="flex items-center justify-between text-sm">
                <span>Prezzo prodotto</span>
                <span className="font-semibold">{euro(total)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Buono usato</span>
                <span className="font-semibold text-destructive">−{euro(split.used)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Buono rimanente</span>
                <span className="font-semibold">{euro(split.remaining)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm font-medium">Da pagare</span>
                <span className="font-display text-xl font-semibold">{euro(split.toPay)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
            <Button type="submit" disabled={busy || !clientId || !product || total <= 0}>
              <ShoppingBag className="h-4 w-4" /> {busy ? "Salvataggio…" : "Conferma vendita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
