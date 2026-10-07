import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Plus, ShoppingBag, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { MovementsTable } from "@/components/MovementsTable";
import { PurchaseDialog, TopUpDialog } from "@/components/forms/BalanceDialogs";
import { Empty, Section, StatCard } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { balancesByClient, errMsg, useClients, useMovements, useRefresh } from "@/lib/data";
import { euro } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/saldo")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Saldo Negozio — Mana Flask" },
      {
        name: "description",
        content: "Saldo spendibile in negozio: ricariche, acquisti e storico movimenti.",
      },
      { property: "og:title", content: "Saldo Negozio — Mana Flask" },
      {
        property: "og:description",
        content: "Saldo spendibile in negozio: ricariche, acquisti e storico movimenti.",
      },
    ],
  }),
  component: BalancePage,
});

function BalancePage() {
  const { data: clients = [] } = useClients();
  const { data: movements = [] } = useMovements();
  const [dlg, setDlg] = useState<null | "topup" | "purchase" | "correction">(null);
  const close = (o: boolean) => !o && setDlg(null);

  const balances = useMemo(() => balancesByClient(movements), [movements]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const rows = clients
    .map((c) => ({ c, b: balances.get(c.id) ?? { balance: 0, loaded: 0, used: 0 } }))
    .filter((r) => r.b.balance !== 0)
    .sort((a, b) => b.b.balance - a.b.balance);
  const all = [...balances.values()];
  const refresh = useRefresh();

  const editBalance = async (id: string, name: string, current: number) => {
    const input = prompt(`Nuovo saldo disponibile per ${name} (€)`, current.toFixed(2).replace(".", ","));
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
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : -1));
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
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Saldo Negozio"
        subtitle="Il saldo è calcolato solo dai movimenti registrati."
        actions={
          <>
            <Button onClick={() => setDlg("topup")}>
              <Plus className="h-4 w-4" /> Ricarica
            </Button>
            <Button variant="secondary" onClick={() => setDlg("purchase")}>
              <ShoppingBag className="h-4 w-4" /> Acquisto
            </Button>
            <Button variant="outline" onClick={() => setDlg("correction")}>
              <SlidersHorizontal className="h-4 w-4" /> Correzione
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Clienti con saldo"
          value={all.filter((b) => b.balance > 0).length}
          tone="info"
        />
        <StatCard
          label="Saldo disponibile"
          value={euro(all.reduce((s, b) => s + b.balance, 0))}
          tone="action"
        />
        <StatCard
          label="Totale caricato"
          value={euro(all.reduce((s, b) => s + b.loaded, 0))}
          tone="success"
        />
        <StatCard
          label="Totale utilizzato"
          value={euro(all.reduce((s, b) => s + b.used, 0))}
          tone="danger"
        />
      </div>

      <Tabs defaultValue="clienti">
        <TabsList className="mb-4">
          <TabsTrigger value="clienti">Clienti</TabsTrigger>
          <TabsTrigger value="movimenti">Tutti i movimenti</TabsTrigger>
        </TabsList>
        <TabsContent value="clienti">
          <Section title="Saldi clienti">
            {!rows.length ? (
              <Empty>Nessun cliente con saldo attivo</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Cliente</th>
                      <th className="py-2 pr-3 text-right font-semibold">Caricato</th>
                      <th className="py-2 pr-3 text-right font-semibold">Utilizzato</th>
                      <th className="py-2 pr-3 text-right font-semibold">Disponibile</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ c, b }) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2.5 pr-3 font-medium">
                          <Link
                            to="/clienti/$id"
                            params={{ id: c.id }}
                            className="hover:text-primary"
                          >
                            {c.first_name} {c.last_name}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-right text-success">{euro(b.loaded)}</td>
                        <td className="py-2.5 pr-3 text-right text-destructive">{euro(b.used)}</td>
                        <td
                          className={cn(
                            "py-2.5 pr-3 text-right font-display font-semibold",
                            b.balance > 0 ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {euro(b.balance)}
                        </td>
                        <td className="whitespace-nowrap py-1 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Modifica credito"
                            onClick={() => editBalance(c.id, `${c.first_name} ${c.last_name}`, b.balance)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Elimina credito"
                            onClick={() => deleteCredit(c.id, `${c.first_name} ${c.last_name}`)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="movimenti">
          <Section title="Storico movimenti">
            <MovementsTable movements={movements} clients={clientMap} />
          </Section>
        </TabsContent>
      </Tabs>

      <TopUpDialog open={dlg === "topup"} onOpenChange={close} />
      <TopUpDialog open={dlg === "correction"} onOpenChange={close} mode="correzione" />
      <PurchaseDialog open={dlg === "purchase"} onOpenChange={close} />
    </div>
  );
}
