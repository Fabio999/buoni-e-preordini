import { Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Participant = { first_name: string; last_name: string; contact: string };
export type ParticipantsState = { mode: "count" | "list"; cap: string; count: string; list: Participant[] };

export function participantsFrom(row?: { participant_cap?: number | null; participant_count?: number | null; participants?: unknown } | null): ParticipantsState {
  const list = Array.isArray(row?.participants) ? (row.participants as Participant[]).map(p => ({ first_name: p.first_name ?? "", last_name: p.last_name ?? "", contact: p.contact ?? "" })) : [];
  return { mode: list.length ? "list" : "count", cap: row?.participant_cap ? String(row.participant_cap) : "", count: row?.participant_count == null ? "" : String(row.participant_count), list };
}

export function participantsRow(s: ParticipantsState) {
  const cap = s.cap === "" ? null : Number(s.cap);
  const list = s.mode === "list" ? s.list.map(p => ({ first_name: p.first_name.trim(), last_name: p.last_name.trim(), contact: p.contact.trim() })).filter(p => p.first_name || p.last_name || p.contact) : [];
  const count = s.mode === "count" && s.count !== "" ? Number(s.count) : null;
  const total = s.mode === "list" ? list.length : count ?? 0;
  if (cap != null && total > cap) throw new Error(`Partecipanti oltre il massimo (${total}/${cap})`);
  return { participant_cap: cap, participant_count: count, participants: list };
}

export function EventParticipants({ value, onChange }: { value: ParticipantsState; onChange: (v: ParticipantsState) => void }) {
  const cap = value.cap === "" ? null : Number(value.cap);
  const total = value.mode === "list" ? value.list.length : Number(value.count || 0);
  const full = cap != null && total >= cap;
  const set = (patch: Partial<ParticipantsState>) => onChange({ ...value, ...patch });
  const edit = (i: number, patch: Partial<Participant>) => set({ list: value.list.map((p, j) => j === i ? { ...p, ...patch } : p) });
  return <section className="space-y-3 border-y py-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><Users className="size-4" />Partecipanti</h3><span className={full ? "rounded-full bg-primary/15 px-2 py-0.5 text-sm font-medium text-primary" : "text-sm text-muted-foreground"}>{total}{cap != null ? ` / ${cap}` : ""}{full ? " · completo" : ""}</span></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm"><span className="font-medium">Massimo partecipanti (facoltativo)</span><Input type="number" min={1} aria-label="Massimo partecipanti" value={value.cap} onChange={e => set({ cap: e.target.value })} /></label>
      <div className="space-y-1 text-sm"><span className="font-medium">Modalità</span><div className="flex gap-2"><Button type="button" size="sm" variant={value.mode === "count" ? "default" : "outline"} onClick={() => set({ mode: "count" })}>Numero totale</Button><Button type="button" size="sm" variant={value.mode === "list" ? "default" : "outline"} onClick={() => set({ mode: "list" })}>Elenco nomi</Button></div></div>
    </div>
    {value.mode === "count" ? <label className="block space-y-1 text-sm"><span className="font-medium">Numero partecipanti</span><Input type="number" min={0} max={cap ?? undefined} aria-label="Numero partecipanti" value={value.count} onChange={e => set({ count: e.target.value })} /></label> : <div className="space-y-2">
      {value.list.map((p, i) => <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_1.3fr_auto]"><Input placeholder="Nome" aria-label={`Nome partecipante ${i + 1}`} value={p.first_name} onChange={e => edit(i, { first_name: e.target.value })} /><Input placeholder="Cognome" aria-label={`Cognome partecipante ${i + 1}`} value={p.last_name} onChange={e => edit(i, { last_name: e.target.value })} /><Input placeholder="Email o cellulare" aria-label={`Contatto partecipante ${i + 1}`} value={p.contact} onChange={e => edit(i, { contact: e.target.value })} /><Button type="button" size="icon" variant="ghost" aria-label={`Rimuovi partecipante ${i + 1}`} onClick={() => set({ list: value.list.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button></div>)}
      <Button type="button" size="sm" variant="outline" disabled={full} onClick={() => set({ list: [...value.list, { first_name: "", last_name: "", contact: "" }] })}><Plus className="size-4" />{full ? "Posti esauriti" : "Aggiungi partecipante"}</Button>
    </div>}
  </section>;
}
