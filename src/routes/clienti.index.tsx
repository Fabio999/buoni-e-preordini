import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarPlus, ChevronDown, ChevronUp, Plus, RotateCcw, Search, ShoppingBag, SlidersHorizontal, Ticket, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { ActiveBalances, BalanceStats, type BalanceDialog } from "@/components/BalancePanel";
import { MovementsTable } from "@/components/MovementsTable";
import { PurchaseDialog, TopUpDialog } from "@/components/forms/BalanceDialogs";
import { BookingDialog } from "@/components/forms/BookingDialog";
import { ClientDialog, selectClass } from "@/components/forms/SimpleDialogs";
import { Empty, Section } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [showFilters, setShowFilters] = useState(false);
  const [bookingClient, setBookingClient] = useState<string | undefined>();
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
          <div className="mb-5 space-y-3 border-b pb-5">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtri rapidi clienti">
              <Button size="sm" variant={balance === "" && booked === "" ? "secondary" : "outline"} aria-pressed={balance === "" && booked === ""} onClick={() => { setBalance(""); setBooked(""); }}>
                <Users /> Tutti
              </Button>
              <Button size="sm" variant={balance === "positivo" ? "secondary" : "outline"} aria-pressed={balance === "positivo"} onClick={() => setBalance(balance === "positivo" ? "" : "positivo")}>
                <Ticket /> Buono attivo
              </Button>
              <Button size="sm" variant={balance === "zero" ? "secondary" : "outline"} aria-pressed={balance === "zero"} onClick={() => setBalance(balance === "zero" ? "" : "zero")}>
                Senza buono
              </Button>
              <Button size="sm" variant={booked === "con" ? "secondary" : "outline"} aria-pressed={booked === "con"} onClick={() => setBooked(booked === "con" ? "" : "con")}>
                <CalendarPlus /> Con prenotazioni
              </Button>
              <Button size="sm" variant="ghost" aria-expanded={showFilters} aria-controls="client-filters" onClick={() => setShowFilters(!showFilters)} className="sm:ml-auto">
                <SlidersHorizontal /> Altri filtri {showFilters ? <ChevronUp /> : <ChevronDown />}
              </Button>
            </div>
          <div id="client-filters" hidden={!showFilters} className={cn("grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", showFilters && "grid")}>
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
          </div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {filtered ? `${rows.length} clienti su ${clients.length}` : `${rows.length} clienti`}
            </h2>
            <span className="hidden text-xs text-muted-foreground sm:block">{sort === "cognome" ? "Cognome A–Z" : sort === "nome" ? "Nome A–Z" : sort === "saldo" ? "Saldo decrescente" : sort === "prenotazioni" ? "Prenotazioni decrescenti" : "Attività più recente"}</span>
          </div>
            {!isLoading && !rows.length && (
              <Empty>
                {clients.length
                  ? "Nessun cliente corrisponde a questa ricerca."
                  : "Nessun cliente: premi Nuovo cliente per iniziare."}
              </Empty>
            )}
            {isLoading && <div className="py-8 text-center text-sm text-muted-foreground" role="status">Caricamento clienti…</div>}
            <ul className="space-y-2">
              {rows.map(({ client: c, balance: bal, bookings: n, lastActivity: last }) => (
                <li key={c.id} className={cn("grid min-w-0 gap-x-5 gap-y-3 rounded-lg border border-l-[3px] bg-card p-4 transition-colors hover:border-secondary/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", bal > 0 ? "border-l-success" : "border-l-border")}>
                  <Link
                    to="/clienti/$id"
                    params={{ id: c.id }}
                    className="group flex min-w-0 items-start gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold uppercase text-accent-foreground">
                        {c.first_name[0]}
                        {c.last_name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-semibold group-hover:text-secondary">
                          {c.first_name} {c.last_name}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant={bal > 0 ? "success" : bal < 0 ? "danger" : "neutral"} className="max-w-full gap-1.5 whitespace-normal break-words">
                            <Ticket className="h-3 w-3 shrink-0" />
                            {bal > 0 ? `Buono attivo · ${euro(bal)}` : bal < 0 ? `Saldo · ${euro(bal)}` : "Nessun buono"}
                          </Badge>
                          {n > 0 && <Badge variant="info" className="gap-1.5"><CalendarPlus className="h-3 w-3" />{n} {n === 1 ? "prenotazione" : "prenotazioni"}</Badge>}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Ultima attività {fmtDate(last)}
                        </div>
                      </div>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
                    <Button
                      size="sm"
                      variant="default"
                      title={`Ricarica buono di ${c.first_name} ${c.last_name}`}
                      aria-label={`Ricarica buono di ${c.first_name} ${c.last_name}`}
                      onClick={() => openDialog("topup", c.id)}
                    >
                      <Plus className="h-4 w-4" /> Ricarica
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Nuova prenotazione per ${c.first_name} ${c.last_name}`}
                      onClick={() => setBookingClient(c.id)}
                    >
                      <CalendarPlus className="h-4 w-4" /> Prenota
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
      <BookingDialog open={bookingClient !== undefined} onOpenChange={(value) => { if (!value) setBookingClient(undefined); }} defaultClientId={bookingClient} />
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
