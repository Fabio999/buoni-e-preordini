import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { ProductDialog } from "@/components/forms/SimpleDialogs";
import { Empty, Section } from "@/components/Status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useProducts, useRefresh, type Product } from "@/lib/data";
import { euro } from "@/lib/format";
import { matchesText } from "@/lib/search";

export const Route = createFileRoute("/prodotti")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Prodotti — Mana Flask" },
      { name: "description", content: "Catalogo prodotti e oggetti prenotabili di Mana Flask." },
      { property: "og:title", content: "Prodotti — Mana Flask" },
      {
        property: "og:description",
        content: "Catalogo prodotti e oggetti prenotabili di Mana Flask.",
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const refresh = useRefresh();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const filtered = products.filter((p) =>
    matchesText(`${p.name} ${p.category} ${p.sku ?? ""} ${p.game} ${p.product_type}`, q),
  );

  const remove = async (p: Product) => {
    if (!confirm(`Eliminare "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    refresh();
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Prodotti"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nuovo prodotto
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Cerca nome, gioco, tipo, categoria, SKU"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Section title={`${filtered.length} prodotti`}>
        {!isLoading && !filtered.length && <Empty>Nessun prodotto</Empty>}
        <ul className="divide-y">
          {filtered.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="font-medium">{p.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {p.game && <Badge variant="info">{p.game}</Badge>}
                  {p.product_type && <Badge variant="info">{p.product_type}</Badge>}
                  {p.category && <Badge variant="info">{p.category}</Badge>}
                  {p.sku && <span>SKU {p.sku}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-2 font-display font-semibold">{euro(p.price)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                  aria-label="Modifica"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(p)} aria-label="Elimina">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <ProductDialog open={open} onOpenChange={setOpen} initial={editing} />
    </div>
  );
}
