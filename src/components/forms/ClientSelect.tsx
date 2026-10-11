import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useClients } from "@/lib/data";
import { ClientDialog } from "./SimpleDialogs";
import { SearchSelect, type SearchOption } from "./SearchSelect";

export function ClientSelect({
  value,
  onChange,
  fixed = false,
}: {
  value: string;
  onChange: (value: string) => void;
  fixed?: boolean;
}) {
  const { data: clients = [] } = useClients();
  const [creating, setCreating] = useState(false);

  const options: SearchOption[] = clients.map((client) => ({
    id: client.id,
    label: `${client.last_name} ${client.first_name}`.trim(),
    keywords: [`${client.first_name} ${client.last_name}`],
  }));

  return (
    <>
      <div className="flex gap-2">
        <SearchSelect
          label="Cliente"
          className="flex-1"
          value={value}
          onChange={onChange}
          options={options}
          disabled={fixed}
          onCreate={fixed ? undefined : () => setCreating(true)}
          searchPlaceholder="Cerca per nome o cognome…"
          emptyHint="Nessun cliente trovato: crealo con ＋."
        />
        {!fixed && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="shrink-0"
            aria-label="Nuovo cliente"
            title="Nuovo cliente"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ClientDialog open={creating} onOpenChange={setCreating} onSaved={onChange} />
    </>
  );
}
