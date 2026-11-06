import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RANK_LABELS, useIsAdmin, type StaffRank } from "@/lib/data";

export function useStaffRanks() {
  return useQuery({
    queryKey: ["staff-ranks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_ranks").select("name_key, rank");
      if (error) throw error;
      return new Map(data.map((r) => [r.name_key, r.rank as StaffRank]));
    },
  });
}
const keyOf = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** Shows a person's rank; administrators can change it (a PIN is required for ranked names). */
export function RankEditor({ name }: { name: string }) {
  const { data: ranks } = useStaffRanks();
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const current = ranks?.get(keyOf(name)) ?? "nessuno";
  const [open, setOpen] = useState(false);
  const [rank, setRank] = useState<StaffRank>(current);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("set_staff_rank", { _name: name, _rank: rank, _pin: pin });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${name}: ${RANK_LABELS[rank]}`);
    setOpen(false); setPin("");
    void qc.invalidateQueries({ queryKey: ["staff-ranks"] });
    void qc.invalidateQueries({ queryKey: ["rank"] });
  }

  const badge = <Badge variant={current === "nessuno" ? "outline" : "info"}>{RANK_LABELS[current]}</Badge>;
  if (!isAdmin) return badge;
  if (!open) return (
    <button type="button" className="inline-flex items-center gap-1" title="Cambia diritti" onClick={() => { setRank(current); setOpen(true); }}>
      {badge}<ShieldCheck className="size-3.5 text-muted-foreground" />
    </button>
  );
  return (
    <div className="mt-1 w-full space-y-2 rounded-md border bg-muted/40 p-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Diritti">
        {(["amministratore", "responsabile", "nessuno"] as const).map((r) => (
          <Button key={r} type="button" size="sm" variant={rank === r ? "secondary" : "outline"} aria-pressed={rank === r} onClick={() => setRank(r)}>{RANK_LABELS[r]}</Button>
        ))}
      </div>
      {rank !== "nessuno" && (
        <Input type="password" inputMode="numeric" autoComplete="new-password" placeholder={current === "nessuno" ? "PIN (almeno 4 cifre)" : "Nuovo PIN (vuoto = invariato)"} aria-label="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
      )}
      <div className="flex gap-1">
        <Button type="button" size="sm" disabled={busy} onClick={save}>Salva</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
      </div>
    </div>
  );
}
