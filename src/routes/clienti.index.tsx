import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { ClientDialog, selectClass } from "@/components/forms/SimpleDialogs";
import { Empty, Section } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { balancesByClient, useBookings, useClients, useMovements, type Client } from "@/lib/data";
import { euro } from "@/lib/format";
import { matchesText } from "@/lib/search";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clienti/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Clienti — Mana Flask" },
      { name: "description", content: "Anagrafica clienti di Mana Flask." },
      { property: "og:title", content: "Clienti — Mana Flask" },
      { property: "og:description", content: "Anagrafica clienti di Mana Flask." },
    ],
  }),
  component: ClientsPage,
});

type SortKey = "cognome" | "nome" | "saldo" | "prenotazioni";

function ClientsPage() {
  const { data: clients = [], isLoading } = useClients();
  const { data: bookings = [] } = useBookings();
  const { data: movements } = useMovements();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("cognome");
  const [balance, setBalance] = useState("");
  const [booked, setBooked] = useState("");
  const [open, setOpen] = useState(false);
  const balances = useMemo(() => balancesByClient(movements), [movements]);

  const rows = useMemo(() => {
    const base = clients.map((c) => ({
      client: c,
      balance: balances.get(c.id)?.balance ?? 0,
      bookings: bookings.filter((b) => b.client_id === c.id).length,
    }));
    const kept = base.filter((r) => {
      const { first_name: f, last_name: l } = r.client;
      if (!matchesText(`${f} ${l}`, q, [`${l} ${f}`])) return false;
      if (balance === "positivo" && !(r.balance > 0)) return false;
      if (balance === "zero" && r.balance !== 0) return false;
      if (balance === "negativo" && !(r.balance < 0)) return false;
      if (booked === "con" && r.bookings === 0) return false;
      if (booked === "senza" && r.bookings > 0) return false;
      return true;
    });
    const byName = (a: Client, b: Client) =>
      a.last_name.localeCompare(b.last_name, "it") ||
      a.first_name.localeCompare(b.first_name, "it");
    return kept.sort((a, b) => {
      if (sort === "nome")
        return (
          a.client.first_name.localeCompare(b.client.first_name, "it") ||
          byName(a.client, b.client)
        );
      if (sort === "saldo") return b.balance - a.balance || byName(a.client, b.client);
      if (sort === "prenotazioni")
        return b.bookings - a.bookings || byName(a.client, b.client);
      return byName(a.client, b.client);
    });
  }, [clients, balances, bookings, q, sort, balance, booked]);

  const filtered = q.trim() !== "" || balance !== "" || booked !== "" || sort !== "cognome";
  const reset = () => {
    setQ("");
    setBalance("");
    setBooked("");
    setSort("cognome");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Clienti"
        subtitle="Cerca per nome o cognome, oppure filtra per saldo e prenotazioni."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nuovo cliente
          </Button>
        }
      />
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-sm">
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
            aria-label="Ordina clienti"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="cognome">Ordina: cognome A-Z</option>
            <option value="nome">Ordina: nome A-Z</option>
            <option value="saldo">Ordina: saldo, dal più alto</option>
            <option value="prenotazioni">Ordina: prenotazioni, dal più alto</option>
          </select>
        </div>
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
          {rows.map(({ client: c, balance: bal, bookings: n }) => (
            <li key={c.id}>
              <Link
                to="/clienti/$id"
                params={{ id: c.id }}
                className="flex items-center justify-between gap-3 px-1 py-3 hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {c.first_name[0]}
                    {c.last_name[0]}
                  </div>
                  <div>
                    <div className="font-medium">
                      {c.first_name} {c.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">{n} prenotazioni</div>
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
            </li>
          ))}
        </ul>
      </Section>
      <ClientDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
