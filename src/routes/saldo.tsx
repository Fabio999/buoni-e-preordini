import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { MovementsTable } from "@/components/MovementsTable";
import { PurchaseDialog, TopUpDialog } from "@/components/forms/BalanceDialogs";
import { Empty, Section, StatCard } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { balancesByClient, useClients, useMovements } from "@/lib/data";
import { euro } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/saldo")({
  head: () => ({
    meta: [
      { title: "Saldo Negozio — Mana Flask" },
      { name: "description", content: "Saldo spendibile in negozio: ricariche, acquisti e storico movimenti." },
      { property: "og:title", content: "Saldo Negozio — Mana Flask" },
      { property: "og:description", content: "Saldo spendibile in negozio: ricariche, acquisti e storico movimenti." },
    ],
  }),
  component: BalancePage,
});

function BalancePage() {
  const { data: clients = [] } = useClients();
  const { data: movements = [] } = useMovements();
  const [filter, setFilter] = useState<"all" | "available" | "empty">("all");
  const [dlg, setDlg] = useState<null | "topup" | "purchase" | "correction">(null);
  const close = (o: boolean) => !o && setDlg(null);

  const balances = useMemo(() => balancesByClient(movements), [movements]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const rows = clients
    .map((c) => ({ c, b: balances.get(c.id) ?? { balance: 0, loaded: 0, used: 0 } }))
    .filter((r) => (filter === "available" ? r.b.balance > 0 : filter === "empty" ? r.b.balance <= 0 : true))
    .sort((a, b) => b.b.balance - a.b.balance);
  const all = [...balances.values()];

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
        <StatCard label="Clienti con saldo" value={all.filter((b) => b.balance > 0).length} tone="info" />
        <StatCard label="Saldo disponibile" value={euro(all.reduce((s, b) => s + b.balance, 0))} tone="action" />
        <StatCard label="Totale caricato" value={euro(all.reduce((s, b) => s + b.loaded, 0))} tone="success" />
        <StatCard label="Totale utilizzato" value={euro(all.reduce((s, b) => s + b.used, 0))} tone="danger" />
      </div>

      <Tabs defaultValue="clienti">
        <TabsList className="mb-4">
          <TabsTrigger value="clienti">Clienti</TabsTrigger>
          <TabsTrigger value="movimenti">Tutti i movimenti</TabsTrigger>
        </TabsList>
        <TabsContent value="clienti">
          <Section
            title="Saldi clienti"
            actions={
              <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
                {([
                  ["all", "Tutti"],
                  ["available", "Con saldo"],
                  ["empty", "Saldo esaurito"],
                ] as const).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={cn("rounded-md px-3 py-1.5", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {l}
                  </button>
                ))}
              </div>
            }
          >
            {!rows.length ? (
              <Empty>Nessun cliente</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Cliente</th>
                      <th className="py-2 pr-3 text-right font-semibold">Caricato</th>
                      <th className="py-2 pr-3 text-right font-semibold">Utilizzato</th>
                      <th className="py-2 text-right font-semibold">Disponibile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ c, b }) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2.5 pr-3 font-medium">
                          <Link to="/clienti/$id" params={{ id: c.id }} className="hover:text-primary">
                            {c.first_name} {c.last_name}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-right text-success">{euro(b.loaded)}</td>
                        <td className="py-2.5 pr-3 text-right text-destructive">{euro(b.used)}</td>
                        <td className={cn("py-2.5 text-right font-display font-semibold", b.balance > 0 ? "text-primary" : "text-muted-foreground")}>
                          {euro(b.balance)}
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
