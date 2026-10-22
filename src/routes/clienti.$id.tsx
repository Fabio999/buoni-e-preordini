import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Pencil,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { BookingsTable } from "@/components/BookingsTable";
import { MovementsTable } from "@/components/MovementsTable";
import { BookingDialog } from "@/components/forms/BookingDialog";
import { PurchaseDialog, SaleDialog, TopUpDialog } from "@/components/forms/BalanceDialogs";
import { ClientDialog } from "@/components/forms/SimpleDialogs";
import { Empty, Section, StatCard } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  balancesByClient,
  errMsg,
  useBookings,
  useClients,
  useMovements,
  usePurchases,
  useRefresh,
} from "@/lib/data";
import { euro, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/clienti/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Scheda cliente — Mana Flask" },
      {
        name: "description",
        content: "Prenotazioni, saldo negozio e storico acquisti del cliente.",
      },
      { property: "og:title", content: "Scheda cliente — Mana Flask" },
      {
        property: "og:description",
        content: "Prenotazioni, saldo negozio e storico acquisti del cliente.",
      },
    ],
  }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: clients, isLoading } = useClients();
  const { data: allBookings = [] } = useBookings();
  const { data: allMovements = [] } = useMovements();
  const { data: allPurchases = [] } = usePurchases();
  const [dlg, setDlg] = useState<
    null | "edit" | "booking" | "topup" | "correction" | "purchase" | "sale"
  >(null);
  const close = (o: boolean) => !o && setDlg(null);

  const client = clients?.find((c) => c.id === id);
  const bookings = allBookings.filter((b) => b.client_id === id);
  const movements = allMovements.filter((m) => m.client_id === id);
  const purchases = allPurchases.filter((p) => p.client_id === id);
  const bal = useMemo(
    () => balancesByClient(movements).get(id) ?? { balance: 0, loaded: 0, used: 0 },
    [movements, id],
  );
  // How much of each purchase was paid with the buono (rest was cash).
  const buonoByPurchase = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of movements)
      if (mv.purchase_id) m.set(mv.purchase_id, (m.get(mv.purchase_id) ?? 0) - Number(mv.amount));
    return m;
  }, [movements]);

  if (isLoading) return null;
  if (!client) return <Empty>Cliente non trovato</Empty>;

  const remove = async () => {
    if (!confirm("Eliminare il cliente? Verranno eliminati anche prenotazioni, acquisti e movimenti di saldo."))
      return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    refresh();
    navigate({ to: "/clienti" });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        to="/clienti"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Clienti
      </Link>
      <PageHeader
        title={`${client.first_name} ${client.last_name}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setDlg("edit")}>
              <Pencil className="h-4 w-4" /> Modifica
            </Button>
            <Button variant="ghost" size="icon" onClick={remove} aria-label="Elimina cliente">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Buono disponibile"
          value={euro(bal.balance)}
          tone="action"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard label="Totale caricato" value={euro(bal.loaded)} tone="success" />
        <StatCard label="Totale utilizzato" value={euro(bal.used)} tone="danger" />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={() => setDlg("topup")}>
          <Plus className="h-4 w-4" /> Ricarica buono
        </Button>
        <Button variant="secondary" onClick={() => setDlg("sale")}>
          <ShoppingBag className="h-4 w-4" /> Vendita
        </Button>
        <Button variant="outline" onClick={() => setDlg("purchase")} disabled={bal.balance <= 0}>
          <Wallet className="h-4 w-4" /> Usa buono
        </Button>
        <Button variant="outline" onClick={() => setDlg("correction")}>
          <SlidersHorizontal className="h-4 w-4" /> Correggi buono
        </Button>
      </div>

      <div className="space-y-6">
        <Section
          title={`Prenotazioni (${bookings.length})`}
          actions={
            <Button size="sm" variant="outline" onClick={() => setDlg("booking")}>
              <Plus className="h-4 w-4" /> Nuova
            </Button>
          }
        >
          <BookingsTable bookings={bookings} hide={["client"]} />
        </Section>

        <Section title="Storico acquisti">
          {!purchases.length ? (
            <Empty>Nessun acquisto</Empty>
          ) : (
            <ul className="divide-y">
              {purchases.map((p) => {
                const buono = buonoByPurchase.get(p.id) ?? 0;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <div className="font-medium">
                        {p.quantity}× {p.product_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(p.purchase_date)}
                        {p.notes && ` · ${p.notes}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{euro(p.amount)}</div>
                      {buono > 0 && (
                        <div className="text-xs text-destructive">−{euro(buono)} dal buono</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Storico movimenti saldo">
          <MovementsTable movements={movements} />
        </Section>
      </div>

      <ClientDialog open={dlg === "edit"} onOpenChange={close} initial={client} />
      <BookingDialog open={dlg === "booking"} onOpenChange={close} defaultClientId={id} />
      <TopUpDialog open={dlg === "topup"} onOpenChange={close} clientId={id} />
      <TopUpDialog
        open={dlg === "correction"}
        onOpenChange={close}
        clientId={id}
        mode="correzione"
      />
      <PurchaseDialog open={dlg === "purchase"} onOpenChange={close} clientId={id} />
      <SaleDialog open={dlg === "sale"} onOpenChange={close} clientId={id} />
    </div>
  );
}
