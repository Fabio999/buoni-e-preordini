import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useClients, useEvents, useProducts } from "@/lib/data";
import { euro, fmtDate } from "@/lib/format";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data: clients } = useClients();
  const { data: events } = useEvents();
  const { data: products } = useProducts();

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return null;
    return {
      clients: (clients ?? []).filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(t)).slice(0, 5),
      events: (events ?? []).filter((e) => e.name.toLowerCase().includes(t)).slice(0, 5),
      products: (products ?? []).filter((p) => `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(t)).slice(0, 5),
    };
  }, [q, clients, events, products]);

  const close = () => {
    setOpen(false);
    setQ("");
  };
  const empty = results && !results.clients.length && !results.events.length && !results.products.length;

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Cerca cliente, evento, prodotto…"
        className="pl-9"
      />
      {open && results && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-96 overflow-auto rounded-lg border bg-popover p-2 shadow-lg">
          {empty && <p className="p-3 text-sm text-muted-foreground">Nessun risultato</p>}
          {results.clients.length > 0 && <Group label="Clienti" />}
          {results.clients.map((c) => (
            <Link key={c.id} to="/clienti/$id" params={{ id: c.id }} onClick={close} className="block rounded-md px-3 py-2 text-sm hover:bg-accent">
              {c.first_name} {c.last_name}
            </Link>
          ))}
          {results.events.length > 0 && <Group label="Eventi" />}
          {results.events.map((e) => (
            <Link key={e.id} to="/eventi/$id" params={{ id: e.id }} onClick={close} className="flex justify-between rounded-md px-3 py-2 text-sm hover:bg-accent">
              <span>{e.name}</span>
              <span className="text-muted-foreground">{fmtDate(e.event_date)}</span>
            </Link>
          ))}
          {results.products.length > 0 && <Group label="Prodotti" />}
          {results.products.map((p) => (
            <Link key={p.id} to="/prodotti" onClick={close} className="flex justify-between rounded-md px-3 py-2 text-sm hover:bg-accent">
              <span>{p.name}</span>
              <span className="text-muted-foreground">{euro(p.price)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const Group = ({ label }: { label: string }) => (
  <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
);
