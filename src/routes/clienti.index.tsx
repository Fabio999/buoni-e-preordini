import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, RotateCcw, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { ActiveBalances, BalanceStats, type BalanceDialog } from "@/components/BalancePanel";
import { MovementsTable } from "@/components/MovementsTable";
import { PurchaseDialog, TopUpDialog } from "@/components/forms/BalanceDialogs";
import { ClientDialog, selectClass } from "@/components/forms/SimpleDialogs";
import { Empty, Section } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  activityInRange,
  balancesByClient,
  lastActivityByClient,
  useBookings,
  useClients,
  useMovements,
  type ActivityRange,
  type Client,
} from "@/lib/data";
import { euro, fmtDate } from "@/lib/format";
import { matchesText } from "@/lib/search";
import { cn } from "@/lib/utils";

const TABS = ["clienti", "buoni", "movimenti"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/clienti/")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab = search["tab"] as Tab;
    return TABS.includes(tab) && tab !== "clienti" ? { tab } : {};
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Clienti e buoni — Mana Flask" },
      {
        name: "description",
        content:
          "Anagrafica clienti e buoni negozio di Mana Flask: ricariche, acquisti e movimenti.",
      },
      { property: "og:title", content: "Clienti e buoni — Mana Flask" },
      {
        property: "og:description",
        content:
          "Anagrafica clienti e buoni negozio di Mana Flask: ricariche, acquisti e movimenti.",
      },
    ],
  }),
  component: ClientsPage,
});

type SortKey = "cognome" | "nome" | "saldo" | "prenotazioni" | "modifica";

function ClientsPage() {
  const { tab = "clienti" } = Route.useSearch();
  const navigate = useNavigate({ from: "/clienti/" });
  const { data: clients = [], isLoading } = useClients();
  const { data: bookings = [] } = useBookings();
  const { data: movements = [] } = useMovements();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("cognome");
  const [balance, setBalance] = useState("");
  const [booked, setBooked] = useState("");
  const [activity, setActivity] = useState<ActivityRange>("");
  const [open, setOpen] = useState(false);
  const [dlg, setDlg] = useState<BalanceDialog | null>(null);
  const [dlgClient, setDlgClient] = useState<string | undefined>();
  const openDialog = (type: BalanceDialog, clientId?: string) => {
    setDlgClient(clientId);
    setDlg(type);
  };
  const closeDialog = (o: boolean) => !o && setDlg(null);
  const balances = useMemo(() => balancesByClient(movements), [movements]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const lastActivity = useMemo(
    () => lastActivityByClient(clients, movements, bookings),
    [clients, movements, bookings],
  );

  const rows = useMemo(() => {
    const base = clients.map((c) => ({
      client: c,
      balance: balances.get(c.id)?.balance ?? 0,
      bookings: bookings.filter((b) => b.client_id === c.id).length,
      lastActivity: lastActivity.get(c.id) ?? c.created_at,
    }));
    const now = new Date();
    const kept = base.filter((r) => {
      const { first_name: f, last_name: l } = r.client;
      if (!matchesText(`${f} ${l}`, q, [`${l} ${f}`])) return false;
      if (balance === "positivo" && !(r.balance > 0)) return false;
      if (balance === "zero" && r.balance !== 0) return false;
      if (balance === "negativo" && !(r.balance < 0)) return false;
      if (booked === "con" && r.bookings === 0) return false;
      if (booked === "senza" && r.bookings > 0) return false;
      if (!activityInRange(r.lastActivity, activity, now)) return false;
      return true;
    });
    const byName = (a: Client, b: Client) =>
      a.last_name.localeCompare(b.last_name, "it") ||
      a.first_name.localeCompare(b.first_name, "it");
    return kept.sort((a, b) => {
      if (sort === "nome")
        return (
          a.client.first_name.localeCompare(b.client.first_name, "it") || byName(a.client, b.client)
        );
      if (sort === "saldo") return b.balance - a.balance || byName(a.client, b.client);
      if (sort === "prenotazioni") return b.bookings - a.bookings || byName(a.client, b.client);
      if (sort === "modifica")
        return (
          new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime() ||
          byName(a.client, b.client)
        );
      return byName(a.client, b.client);
    });
  }, [clients, balances, bookings, lastActivity, q, sort, balance, booked, activity]);

  const visibleMovements = movements.filter((m) => {
    const client = clientMap.get(m.client_id);
    return matchesText(`${client?.first_name ?? ""} ${client?.last_name ?? ""}`, q);
  });

  const filtered =
    q.trim() !== "" || balance !== "" || booked !== "" || activity !== "" || sort !== "cognome";
  const reset = () => {
    setQ("");
    setBalance("");
    setBooked("");
    setActivity("");
    setSort("cognome");
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Clienti e buoni"
        subtitle="Anagrafica clienti, buoni negozio e storico movimenti."
        actions={
          <>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Nuovo cliente
            </Button>
            <Button variant="secondary" onClick={() => openDialog("topup")}>
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
      <BalanceStats balances={balances} />

      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({ search: value === "clienti" ? {} : { tab: value as Tab }, replace: true })
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="clienti">Clienti</TabsTrigger>
            <TabsTrigger value="buoni">Buoni attivi</TabsTrigger>
            <TabsTrigger value="movimenti">Storico movimenti</TabsTrigger>
          </TabsList>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Cerca per nome o cognome"
                aria-label="Cerca cliente per nome o cognome"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {filtered && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4" /> Reimposta
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="clienti">
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              className={selectClass}
              aria-label="Filtra per saldo"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            >
              <option value="">Tutti i saldi</option>
              <option value="positivo">Saldo maggiore di zero</option>
              <option value="zero">Saldo a zero</option>
              <option value="negativo">Saldo minore di zero</option>
            </select>
            <select
              className={selectClass}
              aria-label="Filtra per prenotazioni"
              value={booked}
              onChange={(e) => setBooked(e.target.value)}
            >
              <option value="">Con o senza prenotazioni</option>
              <option value="con">Con prenotazioni</option>
              <option value="senza">Senza prenotazioni</option>
            </select>
            <select
              className={selectClass}
              aria-label="Filtra per ultima modifica"
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityRange)}
            >
              <option value="">Ultima modifica: sempre</option>
              <option value="7">Modificati negli ultimi 7 giorni</option>
              <option value="30">Modificati negli ultimi 30 giorni</option>
              <option value="90">Modificati negli ultimi 90 giorni</option>
              <option value="oltre90">Non modificati da oltre 90 giorni</option>
            </select>
            <select
              className={selectClass}
              aria-label="Ordina clienti"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="cognome">Ordina: cognome A-Z</option>
              <option value="nome">Ordina: nome A-Z</option>
              <option value="saldo">Ordina: saldo, dal più alto</option>
              <option value="prenotazioni">Ordina: prenotazioni, dal più alto</option>
              <option value="modifica">Ordina: ultima modifica, dalla più recente</option>
            </select>
          </div>
          <Section
            title={
              filtered ? `${rows.length} clienti su ${clients.length}` : `${rows.length} clienti`
            }
          >
            {!isLoading && !rows.length && (
              <Empty>
                {clients.length
                  ? "Nessun cliente corrisponde a questa ricerca."
                  : "Nessun cliente: premi Nuovo cliente per iniziare."}
              </Empty>
            )}
            <ul className="divide-y">
              {rows.map(({ client: c, balance: bal, bookings: n, lastActivity: last }) => (
                <li key={c.id} className="flex items-center gap-2 hover:bg-muted/40">
                  <Link
                    to="/clienti/$id"
                    params={{ id: c.id }}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-1 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                        {c.first_name[0]}
                        {c.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">
                          {c.first_name} {c.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {n} prenotazioni · ultima modifica {fmtDate(last)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-right text-sm font-semibold",
                        bal > 0 ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {euro(bal)}
                      <div className="text-xs font-normal text-muted-foreground">saldo</div>
                    </div>
                  </Link>
                  <div className="flex shrink-0 pr-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title={`Ricarica buono di ${c.first_name} ${c.last_name}`}
                      aria-label={`Ricarica buono di ${c.first_name} ${c.last_name}`}
                      onClick={() => openDialog("topup", c.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={`Usa buono di ${c.first_name} ${c.last_name}`}
                      aria-label={`Usa buono di ${c.first_name} ${c.last_name}`}
                      onClick={() => openDialog("purchase", c.id)}
                    >
                      <ShoppingBag className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </TabsContent>
        <TabsContent value="buoni">
          <ActiveBalances
            clients={clients}
            movements={movements}
            balances={balances}
            search={q}
            onOpen={openDialog}
          />
        </TabsContent>
        <TabsContent value="movimenti">
          <Section title="Storico movimenti">
            <MovementsTable movements={visibleMovements} clients={clientMap} />
          </Section>
        </TabsContent>
      </Tabs>

      <ClientDialog open={open} onOpenChange={setOpen} />
      <TopUpDialog open={dlg === "topup"} onOpenChange={closeDialog} clientId={dlgClient} />
      <TopUpDialog
        open={dlg === "correction"}
        onOpenChange={closeDialog}
        mode="correzione"
        clientId={dlgClient}
      />
      <PurchaseDialog open={dlg === "purchase"} onOpenChange={closeDialog} clientId={dlgClient} />
    </div>
  );
}
