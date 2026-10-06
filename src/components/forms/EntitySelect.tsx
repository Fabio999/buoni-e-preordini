import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useEvents, useProducts, type Product } from "@/lib/data";
import { euro, fmtDate } from "@/lib/format";
import { EventDialog, ProductDialog, selectClass } from "./SimpleDialogs";

function SelectControl({ label, value, onChange, onCreate, children, className = "" }: {
  label: string; value: string; onChange: (id: string) => void;
  onCreate: () => void; children: React.ReactNode; className?: string;
}) {
  return <div className={`flex min-w-0 gap-2 ${className}`}>
    <select required aria-label={label} className={selectClass} value={value}
      onChange={(e) => e.target.value === "new-entity" ? onCreate() : onChange(e.target.value)}>
      <option value="">Seleziona…</option>
      <option value="new-entity">＋ Nuovo {label.toLowerCase()}</option>
      {children}
    </select>
    <Button type="button" variant="outline" size="icon" className="shrink-0"
      title={`Nuovo ${label.toLowerCase()}`} aria-label={`Nuovo ${label.toLowerCase()}`} onClick={onCreate}>
      <Plus className="h-4 w-4" />
    </Button>
  </div>;
}

export function EventSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: events = [] } = useEvents();
  const [creating, setCreating] = useState(false);
  return <>
    <SelectControl label="Evento" value={value} onChange={onChange} onCreate={() => setCreating(true)}>
      {events.map((event) => <option key={event.id} value={event.id}>{event.name} — {fmtDate(event.event_date)}</option>)}
    </SelectControl>
    <EventDialog open={creating} onOpenChange={setCreating} onSaved={onChange} />
  </>;
}

export function ProductSelect({ value, onChange, className = "" }: {
  value: string; onChange: (id: string, product?: Product) => void; className?: string;
}) {
  const { data: products = [] } = useProducts();
  const [creating, setCreating] = useState(false);
  return <>
    <SelectControl label="Prodotto" value={value} className={className} onCreate={() => setCreating(true)}
      onChange={(id) => onChange(id, products.find((p) => p.id === id))}>
      {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({euro(product.price)})</option>)}
    </SelectControl>
    <ProductDialog open={creating} onOpenChange={setCreating} onSaved={(id, product) => onChange(id, product)} />
  </>;
}