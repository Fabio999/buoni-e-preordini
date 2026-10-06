import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { ClientDialog } from "@/components/forms/SimpleDialogs";
import { Empty, Section } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { balancesByClient, useBookings, useClients, useMovements } from "@/lib/data";
import { euro } from "@/lib/format";
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

function ClientsPage() {
  const { data: clients = [], isLoading } = useClients();
  const { data: bookings = [] } = useBookings();
  const { data: movements } = useMovements();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const balances = useMemo(() => balancesByClient(movements), [movements]);
  const filtered = clients.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Clienti"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nuovo cliente
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Cerca per nome o cognome"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Section title={`${filtered.length} clienti`}>
        {!isLoading && !filtered.length && <Empty>Nessun cliente</Empty>}
        <ul className="divide-y">
          {filtered.map((c) => {
            const bal = balances.get(c.id)?.balance ?? 0;
            const n = bookings.filter((b) => b.client_id === c.id).length;
            return (
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
            );
          })}
        </ul>
      </Section>
      <ClientDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
