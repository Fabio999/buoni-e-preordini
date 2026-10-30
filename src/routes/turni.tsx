import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, Copy, Link2, Pencil, Plus, Power, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MonthControls, ShiftCalendar, ShiftEditDialog, ShiftLegend } from "@/components/shifts/ShiftCalendar";
import { AssignmentDialog, ShiftSchedule } from "@/components/shifts/ShiftSchedule";
import { useIsAdmin } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { manageShiftCollaborator, saveAdminShift, saveShiftAssignment } from "@/lib/shifts.functions";
import { monthBounds, monthDays, SHIFT_STATUSES, type Collaborator, type ShiftAssignment, type ShiftStatus } from "@/lib/shifts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/turni")({
  head: () => ({ meta: [
    { title: "Turni — Mana Flask" }, { name: "description", content: "Calendario dei turni, orari e disponibilità dei collaboratori Mana Flask." },
    { property: "og:title", content: "Turni — Mana Flask" }, { property: "og:description", content: "Calendario dei turni, orari e disponibilità dei collaboratori Mana Flask." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Turni,
});
function Turni() {
  const { data: admin, isLoading } = useIsAdmin();
  if (isLoading) return <p className="text-muted-foreground">Caricamento…</p>;
  if (!admin) return <p className="text-muted-foreground">Questa sezione è riservata all’amministrazione.</p>;
  return <AdminShifts />;
}
function AdminShifts() {
  const qc = useQueryClient();
  const manage = useServerFn(manageShiftCollaborator);
  const save = useServerFn(saveAdminShift);
  const saveAssignment = useServerFn(saveShiftAssignment);
  const [assignmentDialog, setAssignmentDialog] = useState<{ day: string; personId?: string } | null>(null);
  const [month, setMonth] = useState(() => formatInTimeZone(new Date(), "Europe/Rome", "yyyy-MM"));
  const [selected, setSelected] = useState<string>("");
  const [editing, setEditing] = useState<{ person: Collaborator; day: string } | null>(null);
  const [personDialog, setPersonDialog] = useState<Collaborator | "new" | null>(null);
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const people = useQuery({ queryKey: ["shift-people"], staleTime: 300000, queryFn: async () => {
    const { data, error } = await supabase.from("shift_collaborators").select("id,first_name,last_name,active,realtime_topic").order("last_name");
    if (error) throw error; return data;
  } });
  const entries = useQuery({ queryKey: ["shift-entries", month], staleTime: 300000, queryFn: async () => {
    const bounds = monthBounds(month);
    const { data, error } = await supabase.from("shift_availability").select("*").gte("day", bounds.first).lte("day", bounds.last);
    if (error) throw error; return data;
  } });
  const assignments = useQuery({ queryKey: ["shift-assignments", month], staleTime: 300000, queryFn: async (): Promise<ShiftAssignment[]> => {
    const bounds = monthBounds(month);
    const { data, error } = await supabase.from("shift_assignments").select("*").gte("day", bounds.first).lte("day", bounds.last).order("starts_at");
    if (error) throw error;
    return (data ?? []).map(e => ({ ...e, status: e.status === "accettato" ? "accettato" : "rifiutato" }));
  } });
  useEffect(() => {
    const channel = supabase.channel(`shift-admin-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_availability" }, () => { qc.invalidateQueries({ queryKey: ["shift-entries"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_collaborators" }, () => { qc.invalidateQueries({ queryKey: ["shift-people"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_assignments" }, () => { qc.invalidateQueries({ queryKey: ["shift-assignments"] }); })
      .subscribe(status => { if (status === "SUBSCRIBED") { qc.invalidateQueries({ queryKey: ["shift-people"] }); qc.invalidateQueries({ queryKey: ["shift-entries"] }); qc.invalidateQueries({ queryKey: ["shift-assignments"] }); } });
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);
  async function action(data: { action: "create" | "rename" | "rotate" | "activate" | "delete"; id?: string | undefined; first_name?: string; last_name?: string; active?: boolean }) {
    setBusy(true);
    try {
      const result = await manage({ data });
      if (result.token) setLink({ name: data.first_name ? `${data.first_name} ${data.last_name}` : fullName(people.data?.find(p => p.id === data.id)), url: `${window.location.origin}/disponibilita#${result.token}` });
      await qc.invalidateQueries({ queryKey: ["shift-people"] });
      await qc.invalidateQueries({ queryKey: ["shift-entries"] });
      await qc.invalidateQueries({ queryKey: ["shift-assignments"] });
      return true;
    } catch (error) { toast.error((error as Error).message); return false; }
    finally { setBusy(false); }
  }
  const all = people.data ?? [];
  const current = all.find(p => p.id === selected);
  const days = monthDays(month).filter(d => d.startsWith(month));
  const lookup = new Map((entries.data ?? []).map(e => [`${e.collaborator_id}:${e.day}`, e]));
  return <div><PageHeader title="Turni" actions={<Button onClick={() => setPersonDialog("new")}><Plus />Collaboratore</Button>} /><div className="mb-6 flex flex-wrap items-center gap-4"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" />{all.filter(p => p.active).length} collaboratori attivi</span><ShiftLegend /></div>{people.error || entries.error ? <p className="mb-4 text-destructive">Impossibile caricare i turni. <Button variant="link" onClick={() => { people.refetch(); entries.refetch(); }}>Riprova</Button></p> : null}
    <div className="mb-5 flex flex-wrap gap-2"><Button variant={!selected ? "secondary" : "outline"} onClick={() => setSelected("")}>Tutti</Button>{all.map(p => <Button key={p.id} variant={selected === p.id ? "secondary" : "outline"} onClick={() => setSelected(p.id)} className="max-w-full whitespace-normal break-words">{fullName(p)}{!p.active && <span className="text-xs opacity-70">Disattivato</span>}</Button>)}</div>
    <MonthControls month={month} onChange={setMonth} />
    <section className="mb-8"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Calendario turni</h2><Button disabled={!all.length} onClick={() => setAssignmentDialog({ day: `${month}-01`, personId: current?.id })}><Plus />Nuovo turno</Button></div>{assignments.error ? <p className="text-destructive">Impossibile caricare i turni. <Button variant="link" onClick={() => assignments.refetch()}>Riprova</Button></p> : <ShiftSchedule month={month} people={current ? [current] : all} assignments={(assignments.data ?? []).filter(e => !current || e.collaborator_id === current.id)} onEdit={(day, personId) => { if (all.length) setAssignmentDialog({ day, personId: personId ?? current?.id }); }} />}</section>
    <h2 className="mb-4 text-lg font-semibold">Disponibilità dei collaboratori</h2>
    {people.isLoading || entries.isLoading ? <p className="py-10 text-muted-foreground">Caricamento…</p> : !all.length ? <div className="py-16 text-center"><CalendarClock className="mx-auto mb-4 size-10 text-info" /><h2 className="text-lg font-semibold">Nessun collaboratore</h2><Button className="mt-5" onClick={() => setPersonDialog("new")}><Plus />Aggiungi collaboratore</Button></div> : current ? <ShiftCalendar month={month} entries={(entries.data ?? []).filter(e => e.collaborator_id === current.id)} onEdit={day => setEditing({ person: current, day })} /> : <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full border-collapse text-sm"><thead className="bg-muted/60"><tr><th className="sticky left-0 z-10 min-w-40 bg-muted p-3 text-left">Collaboratore</th>{days.map(day => <th key={day} className="min-w-12 border-l px-1 py-3"><span className="block text-[10px] font-medium text-muted-foreground">{new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "short" })}</span>{Number(day.slice(-2))}</th>)}</tr></thead><tbody>{all.map(p => <tr key={p.id} className="border-t"><th className="sticky left-0 z-10 bg-card p-3 text-left"><Button variant="link" className="h-auto max-w-48 whitespace-normal break-words p-0 text-left text-foreground" onClick={() => setSelected(p.id)}>{fullName(p)}</Button></th>{days.map(day => {
      const entry = lookup.get(`${p.id}:${day}`); const state = SHIFT_STATUSES.find(s => s.value === entry?.status);
      return <td key={day} className="border-l p-1"><Button variant="ghost" className={cn("h-10 w-full border", state?.className ?? "border-transparent")} aria-label={`${fullName(p)}, ${day}${state ? `: ${state.label}` : ""}`} title={entry?.note || state?.label} onClick={() => setEditing({ person: p, day })}><span className={cn("size-2.5 rounded-full", state?.dot ?? "bg-muted")} />{entry?.note && <span className="text-[10px]">•</span>}</Button></td>;
    })}</tr>)}</tbody></table></div>}
    {all.length > 0 && <section className="mt-8 border-t pt-6"><h2 className="mb-4 text-lg font-semibold">Collaboratori e link personali</h2><ul className="divide-y">{all.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words font-medium">{fullName(p)}</p><p className="text-xs text-muted-foreground">{p.active ? "Link abilitato" : "Link disattivato"}</p></div><div className="flex flex-wrap gap-1"><Button variant="outline" size="sm" disabled={busy} onClick={() => { if (confirm(`Generare un nuovo link per ${fullName(p)}? Il precedente non funzionerà più.`)) action({ action: "rotate", id: p.id }); }}><Link2 />Nuovo link</Button><Button variant="ghost" size="icon" title="Modifica nome" aria-label={`Modifica ${fullName(p)}`} disabled={busy} onClick={() => setPersonDialog(p)}><Pencil /></Button><Button variant="ghost" size="icon" title={p.active ? "Disattiva link" : "Riattiva link"} aria-label={`${p.active ? "Disattiva" : "Riattiva"} ${fullName(p)}`} disabled={busy} onClick={() => action({ action: "activate", id: p.id, active: !p.active })}><Power className={p.active ? "text-info" : "text-muted-foreground"} /></Button><Button variant="ghost" size="icon" title="Elimina collaboratore" aria-label={`Elimina ${fullName(p)}`} disabled={busy} onClick={() => { if (confirm(`Eliminare ${fullName(p)} e tutte le sue disponibilità?`)) action({ action: "delete", id: p.id }); }}><Trash2 className="text-destructive" /></Button></div></li>)}</ul></section>}
    {editing && <ShiftEditDialog day={editing.day} name={fullName(editing.person)} entry={lookup.get(`${editing.person.id}:${editing.day}`)} onClose={() => setEditing(null)} onSave={async (entry: { day: string; status: ShiftStatus | null; note: string }) => {
      try { await save({ data: { ...entry, collaborator_id: editing.person.id } }); await qc.invalidateQueries({ queryKey: ["shift-entries"] }); toast.success("Disponibilità salvata"); }
      catch (error) { toast.error((error as Error).message); throw error; }
    }} />}
    {personDialog && <PersonDialog person={personDialog === "new" ? null : personDialog} busy={busy} onClose={() => setPersonDialog(null)} onSave={async (first_name, last_name) => { if (await action({ action: personDialog === "new" ? "create" : "rename", id: personDialog === "new" ? undefined : personDialog.id, first_name, last_name })) setPersonDialog(null); }} />}
    {assignmentDialog && <AssignmentDialog day={assignmentDialog.day} personId={assignmentDialog.personId} people={all} assignments={assignments.data ?? []} onClose={() => setAssignmentDialog(null)} onSave={async entry => { await saveAssignment({ data: { action: "save", entry } }); await qc.invalidateQueries({ queryKey: ["shift-assignments"] }); toast.success("Turno salvato"); }} onDelete={async (collaborator_id, day) => { await saveAssignment({ data: { action: "delete", collaborator_id, day } }); await qc.invalidateQueries({ queryKey: ["shift-assignments"] }); toast.success("Turno eliminato"); }} />}
    {link && <Dialog open onOpenChange={o => !o && setLink(null)}><DialogContent><DialogHeader><DialogTitle>Link personale — {link.name}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Invialo solo al collaboratore: dal medesimo link vedrà i suoi turni con orario e potrà modificare le disponibilità. Copialo ora; non verrà conservato in chiaro.</p><Input readOnly aria-label="Link personale" value={link.url} /><Button onClick={async () => { try { await navigator.clipboard.writeText(link.url); toast.success("Link copiato"); } catch { toast.error("Seleziona e copia il link dal campo"); } }}><Copy />Copia link</Button></DialogContent></Dialog>}
  </div>;
}
function fullName(p?: Pick<Collaborator, "first_name" | "last_name">) { return p ? `${p.first_name} ${p.last_name}` : "Collaboratore"; }
function PersonDialog({ person, busy, onClose, onSave }: { person: Collaborator | null; busy: boolean; onClose: () => void; onSave: (first: string, last: string) => Promise<void> }) {
  const [first, setFirst] = useState(person?.first_name ?? ""); const [last, setLast] = useState(person?.last_name ?? "");
  async function submit(e: FormEvent) { e.preventDefault(); await onSave(first, last); }
  return <Dialog open onOpenChange={o => !o && !busy && onClose()}><DialogContent><DialogHeader><DialogTitle>{person ? "Modifica collaboratore" : "Nuovo collaboratore"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="space-y-2"><Label htmlFor="shift-first">Nome</Label><Input id="shift-first" required maxLength={80} value={first} onChange={e => setFirst(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="shift-last">Cognome</Label><Input id="shift-last" required maxLength={80} value={last} onChange={e => setLast(e.target.value)} /></div><Button type="submit" disabled={busy || !first.trim() || !last.trim()}>{busy ? "Salvataggio…" : "Salva collaboratore"}</Button></form></DialogContent></Dialog>;
}