import { Link } from "@tanstack/react-router";
import { Pencil, Plus, ShoppingBag, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Empty, Section, StatCard } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useRefresh, type Client, type Movement } from "@/lib/data";
import { euro } from "@/lib/format";
import { matchesText } from "@/lib/search";
import { cn } from "@/lib/utils";

export type BalanceDialog = "topup" | "purchase" | "correction";
type Balances = Map<string, { balance: number; loaded: number; used: number }>;

export function BalanceStats({ balances }: { balances: Balances }) {
  const all = [...balances.values()];
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Clienti con buono attivo"
        value={all.filter((b) => b.balance > 0).length}
        tone="info"
      />
      <StatCard
        label="Buoni disponibili"
        value={euro(all.reduce((s, b) => s + b.balance, 0))}
        tone="action"
        icon={<Ticket className="h-4 w-4" />}
      />
      <StatCard
        label="Totale aggiunto"
        value={euro(all.reduce((s, b) => s + b.loaded, 0))}
        tone="success"
      />
      <StatCard
        label="Speso con buoni"
        value={euro(all.reduce((s, b) => s + b.used, 0))}
        tone="danger"
      />
    </div>
  );
}

export function ActiveBalances({
  clients,
  movements,
  balances,
  search,
  onOpen,
}: {
  clients: Client[];
  movements: Movement[];
  balances: Balances;
  search: string;
  onOpen: (type: BalanceDialog, clientId?: string) => void;
}) {
  const refresh = useRefresh();
  const rows = clients
    .map((c) => ({ c, b: balances.get(c.id) ?? { balance: 0, loaded: 0, used: 0 } }))
    .filter((r) => r.b.balance !== 0)
    .sort((a, b) => b.b.balance - a.b.balance);
  const visibleRows = rows.filter(({ c }) => matchesText(`${c.first_name} ${c.last_name}`, search));

  const editBalance = async (id: string, name: string, current: number) => {
    const input = prompt(
      `Nuovo saldo disponibile per ${name} (€)`,
      current.toFixed(2).replace(".", ","),
    );
    if (input == null) return;
    const value = Number(input.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Importo non valido");
      return;
    }
    const diff = Math.round((value - current) * 100) / 100;
    if (diff === 0) return;
    const { error } = await supabase.rpc("add_balance_movement", {
      _client: id,
      _type: "correzione",
      _amount: diff,
      _description: "Modifica saldo",
    });
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("Saldo aggiornato");
    refresh();
  };

  const deleteCredit = async (id: string, name: string) => {
    if (!confirm(`Eliminare tutto il credito e lo storico movimenti di ${name}?`)) return;
    const list = movements
      .filter((m) => m.client_id === id)
      .sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : -1,
      );
    for (const m of list) {
      const { error } = await supabase.rpc("delete_balance_movement", { _id: m.id });
      if (error) {
        toast.error(errMsg(error));
        refresh();
        return;
      }
    }
    toast.success("Credito eliminato");
    refresh();
  };

  return (
    <Section title={`Buoni attivi (${visibleRows.length})`}>
      {!visibleRows.length ? (
        <Empty>{search ? "Nessun cliente trovato" : "Nessun buono disponibile"}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Cliente</th>
                <th className="py-2 pr-3 text-right font-semibold">Buono disponibile</th>
                <th className="py-2 pr-3 text-right font-semibold">Totale aggiunto</th>
                <th className="py-2 pr-3 text-right font-semibold">Speso</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ c, b }) => {
                const name = `${c.first_name} ${c.last_name}`;
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-3 font-medium">
                      <Link to="/clienti/$id" params={{ id: c.id }} className="hover:text-primary">
                        {name}
                      </Link>
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pr-3 text-right font-display font-semibold",
                        b.balance > 0 ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {euro(b.balance)}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-muted-foreground">
                      {euro(b.loaded)}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-muted-foreground">{euro(b.used)}</td>
                    <td className="whitespace-nowrap py-1 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        title={`Ricarica buono di ${name}`}
                        aria-label={`Ricarica buono di ${name}`}
                        onClick={() => onOpen("topup", c.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={`Usa buono di ${name}`}
                        aria-label={`Usa buono di ${name}`}
                        onClick={() => onOpen("purchase", c.id)}
                      >
                        <ShoppingBag className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Modifica credito"
                        title="Modifica credito"
                        onClick={() => editBalance(c.id, name, b.balance)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Elimina credito"
                        title="Elimina credito"
                        onClick={() => deleteCredit(c.id, name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
