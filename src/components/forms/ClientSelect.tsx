import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useClients } from "@/lib/data";
import { ClientDialog, selectClass } from "./SimpleDialogs";

export function ClientSelect({ value, onChange, fixed = false }: {
  value: string;
  onChange: (value: string) => void;
  fixed?: boolean;
}) {
  const { data: clients = [] } = useClients();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="flex gap-2">
        <select
          required
          aria-label="Cliente"
          disabled={fixed}
          className={selectClass}
          value={value}
          onChange={(event) => {
            if (event.target.value === "new-client") setCreating(true);
            else onChange(event.target.value);
          }}
        >
          <option value="">Seleziona…</option>
          {!fixed && <option value="new-client">＋ Nuovo cliente</option>}
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.last_name} {client.first_name}
            </option>
          ))}
        </select>
        {!fixed && (
          <Button type="button" size="icon" variant="outline" className="shrink-0"
            aria-label="Nuovo cliente" title="Nuovo cliente" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ClientDialog open={creating} onOpenChange={setCreating} onSaved={onChange} />
    </>
  );
}