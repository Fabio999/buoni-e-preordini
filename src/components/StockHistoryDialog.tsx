import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/Status";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/format";

const SOURCE: Record<string, string> = {
  manuale: "Manuale",
  prenotazione: "Prenotazione",
  prenotazione_annullata: "Prenotazione modificata/eliminata",
  acquisto: "Acquisto",
  acquisto_annullato: "Acquisto modificato/eliminato",
};

export function StockHistoryDialog({
  product,
  onOpenChange,
}: {
  product: { id: string; name: string } | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["stock_movements", product?.id],
    enabled: !!product,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("product_id", product!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Storico quantità — {product?.name}</DialogTitle>
        </DialogHeader>
        {!isLoading && !data.length && <Empty>Nessun movimento di magazzino</Empty>}
        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {data.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{SOURCE[m.source] ?? m.source}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDateTime(m.created_at)}
                  {m.label && <> · {m.label}</>}
                  {m.operator_name && <> · da {m.operator_name}</>}
                  {m.booking_id && m.source === "prenotazione" && (
                    <> · <Link to="/prenotazioni" className="text-primary underline">vedi prenotazioni</Link></>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.delta > 0 ? "success" : "danger"}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </Badge>
                <span className="w-16 text-right text-muted-foreground">{m.stock_after} pz</span>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
