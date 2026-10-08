import { ArrowDownRight, ArrowUpRight, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useRefresh } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import type { Client, Movement } from "@/lib/data";
import { euro, fmtDateTime, fullName, MOVEMENT_TYPE } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Empty } from "./Status";

const icons = { ricarica: ArrowUpRight, acquisto: ArrowDownRight, correzione: SlidersHorizontal };

export function MovementsTable({
  movements,
  clients,
}: {
  movements: Movement[];
  clients?: Map<string, Client>;
}) {
  const refresh = useRefresh();
  const [editing, setEditing] = useState<Movement | null>(null);
  if (!movements.length) return <Empty>Nessun movimento</Empty>;
  const remove = async (m: Movement) => {
    if (!confirm("Eliminare questo movimento? Il saldo verrà ricalcolato.")) return;
    const { error } = await supabase.rpc("delete_balance_movement", { _id: m.id });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Movimento eliminato");
    refresh();
  };
  return (
    <>
    <MovementEditDialog movement={editing} onClose={() => setEditing(null)} />
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">Data</th>
            {clients && <th className="py-2 pr-3 font-semibold">Cliente</th>}
            <th className="py-2 pr-3 font-semibold">Tipo</th>
            <th className="py-2 pr-3 font-semibold">Descrizione</th>
            <th className="py-2 pr-3 text-right font-semibold">Importo</th>
            <th className="py-2 pr-3 text-right font-semibold">Saldo prec.</th>
            <th className="py-2 pr-3 text-right font-semibold">Saldo succ.</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => {
            const t = MOVEMENT_TYPE[m.type];
            const Icon = icons[m.type];
            const amt = Number(m.amount);
            return (
              <tr key={m.id} className="border-b last:border-0">
                <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">
                  {fmtDateTime(m.created_at)}
                </td>
                {clients && (
                  <td className="py-2.5 pr-3 font-medium">{fullName(clients.get(m.client_id))}</td>
                )}
                <td className="py-2.5 pr-3">
                  <Badge variant={t.variant} className="gap-1">
                    <Icon className="h-3 w-3" />
                    {t.label}
                  </Badge>
                </td>
                <td className="py-2.5 pr-3">
                  {m.description}
                  {m.operator_name && <div className="text-xs text-muted-foreground">da {m.operator_name}</div>}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap py-2.5 pr-3 text-right font-semibold",
                    amt < 0 ? "text-destructive" : "text-success",
                  )}
                >
                  {amt > 0 ? "+" : "−"}
                  {euro(Math.abs(amt))}
                </td>
                <td className="py-2.5 pr-3 text-right text-muted-foreground">
                  {euro(m.balance_before)}
                </td>
                <td className="py-2.5 pr-3 text-right font-semibold">{euro(m.balance_after)}</td>
                <td className="whitespace-nowrap py-1 text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(m)} aria-label="Modifica movimento">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(m)} aria-label="Elimina movimento">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function MovementEditDialog({ movement, onClose }: { movement: Movement | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (movement && movement.id !== lastId) {
    setLastId(movement.id);
    setAmount(String(Math.abs(Number(movement.amount))));
    setDescription(movement.description);
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!movement) return;
    const value = Number(amount.replace(",", "."));
    if (!value) { toast.error("Importo non valido"); return; }
    const signed =
      movement.type === "ricarica"
        ? Math.abs(value)
        : movement.type === "acquisto"
          ? -Math.abs(value)
          : Number(movement.amount) < 0
            ? -Math.abs(value)
            : Math.abs(value);
    setBusy(true);
    const { error } = await supabase.rpc("update_balance_movement", {
      _id: movement.id,
      _amount: signed,
      _description: description,
    });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Movimento aggiornato");
    refresh();
    setLastId(null);
    onClose();
  };
  return (
    <Dialog open={!!movement} onOpenChange={(o) => { if (!o) { setLastId(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica movimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Importo (€)</Label>
            <Input aria-label="Importo" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descrizione</Label>
            <Input aria-label="Descrizione" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">I saldi successivi vengono ricalcolati automaticamente.</p>
          <DialogFooter>
            <Button type="submit" disabled={busy}>Salva</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
