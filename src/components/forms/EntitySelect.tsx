import { useState } from "react";
import { useEvents, useProducts, type Product } from "@/lib/data";
import { euro, fmtDate } from "@/lib/format";
import { EventDialog, ProductDialog } from "./SimpleDialogs";
import { SearchSelect, type SearchOption } from "./SearchSelect";

export function EventSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: events = [] } = useEvents();
  const [creating, setCreating] = useState(false);

  const options: SearchOption[] = events.map((event) => ({
    id: event.id,
    label: event.name,
    hint: fmtDate(event.event_date),
    keywords: [event.location],
  }));

  return (
    <>
      <SearchSelect
        label="Evento"
        value={value}
        onChange={onChange}
        options={options}
        onCreate={() => setCreating(true)}
        searchPlaceholder="Cerca per nome evento o luogo…"
        emptyHint="Nessun evento trovato: crealo con ＋."
      />
      <EventDialog open={creating} onOpenChange={setCreating} onSaved={onChange} />
    </>
  );
}

export function ProductSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (id: string, product?: Product) => void;
  className?: string;
}) {
  const { data: products = [] } = useProducts();
  const [creating, setCreating] = useState(false);

  const options: SearchOption[] = products.map((product) => ({
    id: product.id,
    label: product.name,
    hint: euro(product.price),
    keywords: [product.game, product.product_type, product.category, product.sku],
  }));

  return (
    <>
      <SearchSelect
        label="Prodotto"
        className={className}
        value={value}
        onChange={(id) => onChange(id, products.find((p) => p.id === id))}
        options={options}
        onCreate={() => setCreating(true)}
        searchPlaceholder="Cerca per nome, gioco o tipo…"
        emptyHint="Nessun prodotto trovato: crealo con ＋."
      />
      <ProductDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(id, product) => onChange(id, product)}
      />
    </>
  );
}
