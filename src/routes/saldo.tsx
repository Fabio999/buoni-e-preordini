import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Plus, Search, ShoppingBag, SlidersHorizontal, Trash2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { MovementsTable } from "@/components/MovementsTable";
import { PurchaseDialog, TopUpDialog } from "@/components/forms/BalanceDialogs";
import { Empty, Section, StatCard } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { balancesByClient, errMsg, useClients, useMovements, useRefresh } from "@/lib/data";
import { euro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { matchesText } from "@/lib/search";

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
  const [selectedClient, setSelectedClient] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const openDialog = (type: "topup" | "purchase" | "correction", clientId?: string) => {
    setSelectedClient(clientId);
    setDlg(type);
  };
  const close = (o: boolean) => !o && setDlg(null);

  const balances = useMemo(() => balancesByClient(movements), [movements]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const rows = clients
    .map((c) => ({ c, b: balances.get(c.id) ?? { balance: 0, loaded: 0, used: 0 } }))
    .filter((r) => r.b.balance !== 0)
    .sort((a, b) => b.b.balance - a.b.balance);
  const all = [...balances.values()];
  const visibleRows = rows.filter(({ c }) => matchesText(search, c.first_name, c.last_name));
  const visibleMovements = movements.filter((m) => {
    const client = clientMap.get(m.client_id);
    return matchesText(search, client?.first_name, client?.last_name);
  });
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
        subtitle="Buoni negozio"
        actions={
          <>
            <Button onClick={() => openDialog("topup")}>
              <Plus className="h-4 w-4" /> Ricarica buono
            </Button>
            <Button variant="secondary" onClick={() => openDialog("purchase")}>
              <ShoppingBag className="h-4 w-4" /> Usa buono
            </Button>
            <Button variant="outline" onClick={() => openDialog("correction")}>
              <SlidersHorizontal className="h-4 w-4" /> Correggi buono
            </Button>
          </>
        }
      />
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

      <Tabs defaultValue="clienti">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="clienti">Buoni attivi</TabsTrigger>
            <TabsTrigger value="movimenti">Storico movimenti</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Cerca cliente nei buoni" placeholder="Cerca nome o cognome…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <TabsContent value="clienti">
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
                    {visibleRows.map(({ c, b }) => (
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
                        <td
                          className={cn(
                            "py-2.5 pr-3 text-right font-display font-semibold",
                            b.balance > 0 ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {euro(b.balance)}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-muted-foreground">{euro(b.loaded)}</td>
                        <td className="py-2.5 pr-3 text-right text-muted-foreground">{euro(b.used)}</td>
                        <td className="whitespace-nowrap py-1 text-right">
                          <Button size="icon" variant="ghost" title={`Ricarica buono di ${c.first_name} ${c.last_name}`} aria-label={`Ricarica buono di ${c.first_name} ${c.last_name}`} onClick={() => openDialog("topup", c.id)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title={`Usa buono di ${c.first_name} ${c.last_name}`} aria-label={`Usa buono di ${c.first_name} ${c.last_name}`} onClick={() => openDialog("purchase", c.id)}>
                            <ShoppingBag className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Modifica credito"
                            title="Modifica credito"
                            onClick={() => editBalance(c.id, `${c.first_name} ${c.last_name}`, b.balance)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Elimina credito"
                            title="Elimina credito"
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
            <MovementsTable movements={visibleMovements} clients={clientMap} />
          </Section>
        </TabsContent>
      </Tabs>

      <TopUpDialog open={dlg === "topup"} onOpenChange={close} clientId={selectedClient} />
      <TopUpDialog open={dlg === "correction"} onOpenChange={close} mode="correzione" clientId={selectedClient} />
      <PurchaseDialog open={dlg === "purchase"} onOpenChange={close} clientId={selectedClient} />
    </div>
  );
}
