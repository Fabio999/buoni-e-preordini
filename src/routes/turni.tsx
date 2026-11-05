import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, CalendarRange, Copy, Download, FileSpreadsheet, Link2, RefreshCw, Pencil, Plus, Power, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShiftCalendar, ShiftEditDialog, ShiftLegend } from "@/components/shifts/ShiftCalendar";
import { PeriodControls, ShiftHistoryDialog, ShiftSummary } from "@/components/shifts/ShiftOverview";
import { downloadCsv, toCsv } from "@/lib/csv";
import { AssignmentDialog, ShiftSchedule } from "@/components/shifts/ShiftSchedule";
import { WeekPlanner, type WeekChanges } from "@/components/shifts/WeekPlanner";
import { useIsAdmin } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { createShiftSheet, syncShiftSheets } from "@/lib/shift-sheets.functions";
import { sheetUrl } from "@/lib/shift-sheets";
import { manageShiftCollaborator, publishShifts, saveAdminShift, saveShiftAssignment, saveWeekPlan } from "@/lib/shifts.functions";
import { hoursExportRows, monthBounds, monthDays, monthWeeks, pendingPublication, periodDays, periodLabel, SHIFT_STATUSES, shiftsExportRows, toAssignmentStatus, type Collaborator, type ShiftAssignment, type ShiftStatus, type ShiftView } from "@/lib/shifts";
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
  const publish = useServerFn(publishShifts);
  const syncSheetsFn = useServerFn(syncShiftSheets);
  const createSheetFn = useServerFn(createShiftSheet);
  const saveWeekFn = useServerFn(saveWeekPlan);
  const [planWeek, setPlanWeek] = useState<string[] | null>(null);
  const [assignmentDialog, setAssignmentDialog] = useState<{ day: string; personId?: string | undefined } | null>(null);
  const [view, setView] = useState<ShiftView>("mese");
  const [anchor, setAnchor] = useState(() => formatInTimeZone(new Date(), "Europe/Rome", "yyyy-MM-dd"));
  const month = anchor.slice(0, 7);
  const [history, setHistory] = useState<{ collaboratorId: string; day: string } | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [editing, setEditing] = useState<{ person: Collaborator; day: string } | null>(null);
  const [personDialog, setPersonDialog] = useState<Collaborator | "new" | null>(null);
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const people = useQuery({ queryKey: ["shift-people"], staleTime: 300000, queryFn: async () => {
    const { data, error } = await supabase.from("shift_collaborators").select("id,first_name,last_name,active,realtime_topic,staff_role,contact_email,staff_notes,sheet_id,sheet_synced_at").order("last_name");
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
    return (data ?? []).map(e => ({ ...e, status: toAssignmentStatus(e.status) }));
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
      return (result.id as string | null) ?? data.id ?? null;
    } catch (error) { toast.error((error as Error).message); return null; }
    finally { setBusy(false); }
  }
  async function saveProfile(id: string, profile: Profile) {
    const { error } = await supabase.from("shift_collaborators").update(profile).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await qc.invalidateQueries({ queryKey: ["shift-people"] }); return true;
  }
  const all = people.data ?? [];
  const current = all.find(p => p.id === selected);
  const days = monthDays(month).filter(d => d.startsWith(month));
  const lookup = new Map((entries.data ?? []).map(e => [`${e.collaborator_id}:${e.day}`, e]));
  const period = periodDays(view, anchor);
  const periodFirst = period[0] ?? anchor; const periodLast = period.at(-1) ?? anchor;
  const periodAssignments = (assignments.data ?? []).filter(e => e.day >= periodFirst && e.day <= periodLast);
  const pending = pendingPublication(periodAssignments);
  function exportCsv(kind: "turni" | "ore") {
    const rows = kind === "turni" ? shiftsExportRows(all, periodAssignments) : hoursExportRows(all, periodAssignments, periodFirst, periodLast);
    downloadCsv(`${kind}-mana-flask-${periodFirst}${periodLast === periodFirst ? "" : `_${periodLast}`}.csv`, toCsv(rows));
  }
  async function publishRange(from: string, to: string, question: string) {
    if (!confirm(question)) return false;
    setBusy(true);
    try {
      const result = await publish({ data: { from, to } });
      await qc.invalidateQueries({ queryKey: ["shift-assignments"] });
      const title = `${result.count} ${result.count === 1 ? "turno pubblicato" : "turni pubblicati"}${result.mailed ? ` · ${result.mailed} ${result.mailed === 1 ? "mail inviata" : "mail inviate"}` : ""}`;
      const details = [...(result.noEmail.length ? [`Senza email: ${result.noEmail.join(", ")}`] : []), ...result.errors].join("\n");
      (result.errors.length ? toast.warning : toast.success)(title, { description: details ? <span className="whitespace-pre-line">{details}</span> : undefined, duration: result.errors.length ? 20000 : 6000 });
      return true;
    } catch (error) { toast.error((error as Error).message); return false; }
    finally { setBusy(false); }
  }
  function publishMonth() {
    void publishRange(periodFirst, periodLast, `Confermare e pubblicare ${pending} ${pending === 1 ? "turno" : "turni"} (${periodLabel(view, anchor)})?`);
  }
  async function saveWeek(changes: WeekChanges) {
    const r = await saveWeekFn({ data: changes });
    await qc.invalidateQueries({ queryKey: ["shift-assignments"] });
    const title = `${r.saved} ${r.saved === 1 ? "turno salvato" : "turni salvati"}${r.removed ? ` · ${r.removed} ${r.removed === 1 ? "rimosso" : "rimossi"}` : ""}`;
    (r.sheetWarnings.length ? toast.warning : toast.success)(title, { description: r.sheetWarnings.length ? <span className="whitespace-pre-line">{r.sheetWarnings.join("\n")}</span> : undefined });
  }
  async function syncSheets() {
    setBusy(true);
    try {
      const r = await syncSheetsFn();
      await qc.invalidateQueries({ queryKey: ["shift-entries"] });
      await qc.invalidateQueries({ queryKey: ["shift-people"] });
      const details = [...r.invalid.map(i => `Valore non valido: ${i}`), ...r.late.map(l => `Modifiche dopo la scadenza, ignorate: ${l}`), ...r.errors].join("\n");
      const title = r.people ? `Fogli sincronizzati: ${r.people} · ${r.changed} ${r.changed === 1 ? "giornata cambiata" : "giornate cambiate"}` : "Nessun foglio sincronizzato";
      (details ? toast.warning : toast.success)(title, { description: details ? <span className="whitespace-pre-line">{details}</span> : undefined, duration: details ? 20000 : 5000 });
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  }
  async function createSheet(p: Collaborator) {
    if (!confirm(`Creare il foglio Google di ${fullName(p)} e condividerlo con ${p.contact_email}?`)) return;
    setBusy(true);
    try { await createSheetFn({ data: { id: p.id } }); await qc.invalidateQueries({ queryKey: ["shift-people"] }); toast.success(`Foglio creato e condiviso con ${p.contact_email}`); }
    catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  }
  return <div><PageHeader title="Turni" actions={<><Button variant="outline" disabled={busy || !all.some(p => p.sheet_id)} onClick={syncSheets}><RefreshCw />Sincronizza fogli</Button><Button onClick={() => setPersonDialog("new")}><Plus />Collaboratore</Button></>} /><div className="mb-6 flex flex-wrap items-center gap-4"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" />{all.filter(p => p.active).length} collaboratori attivi</span><ShiftLegend /></div>{people.error || entries.error ? <p className="mb-4 text-destructive">Impossibile caricare i turni. <Button variant="link" onClick={() => { people.refetch(); entries.refetch(); }}>Riprova</Button></p> : null}
    <div className="mb-5 flex flex-wrap gap-2"><Button variant={!selected ? "secondary" : "outline"} onClick={() => setSelected("")}>Tutti</Button>{all.map(p => <Button key={p.id} variant={selected === p.id ? "secondary" : "outline"} onClick={() => setSelected(p.id)} className="max-w-full whitespace-normal break-words">{fullName(p)}{!p.active && <span className="text-xs opacity-70">Disattivato</span>}</Button>)}</div>
    <PeriodControls view={view} anchor={anchor} onView={setView} onAnchor={setAnchor} />
    <section className="mb-8"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Calendario turni</h2><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!all.length} onClick={() => setAssignmentDialog({ day: periodFirst, personId: current?.id })}><Plus />Nuovo turno</Button><Button variant="outline" disabled={!periodAssignments.length} onClick={() => exportCsv("turni")}><Download />Esporta turni</Button><Button variant="outline" disabled={!all.length} onClick={() => exportCsv("ore")}><Download />Esporta ore</Button><Button disabled={busy || !pending} onClick={publishMonth}><Send />{pending ? `Conferma e pubblica turni (${pending})` : "Turni pubblicati"}</Button></div></div>{assignments.error ? <p className="text-destructive">Impossibile caricare i turni. <Button variant="link" onClick={() => assignments.refetch()}>Riprova</Button></p> : <><ShiftSchedule month={month} days={view === "mese" ? undefined : period} people={current ? [current] : all} assignments={(assignments.data ?? []).filter(e => !current || e.collaborator_id === current.id)} onEdit={(day, personId) => { if (all.length) setAssignmentDialog({ day, personId: personId ?? current?.id }); }} /><ShiftSummary days={period} people={current ? [current] : all} assignments={assignments.data ?? []} entries={entries.data ?? []} /></>}</section>
    <h2 className="mb-4 text-lg font-semibold">Disponibilità dei collaboratori</h2>
    {all.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-2"><span className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarRange className="size-4" />Pianifica i turni della settimana:</span>{monthWeeks(month).map(week => <Button key={week[0]} variant="outline" size="sm" disabled={busy || assignments.isLoading} onClick={() => setPlanWeek(week)}>{new Date(`${week[0]}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – {new Date(`${week.at(-1)}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</Button>)}</div>}
    {people.isLoading || entries.isLoading ? <p className="py-10 text-muted-foreground">Caricamento…</p> : !all.length ? <div className="py-16 text-center"><CalendarClock className="mx-auto mb-4 size-10 text-info" /><h2 className="text-lg font-semibold">Nessun collaboratore</h2><Button className="mt-5" onClick={() => setPersonDialog("new")}><Plus />Aggiungi collaboratore</Button></div> : current ? <ShiftCalendar month={month} entries={(entries.data ?? []).filter(e => e.collaborator_id === current.id)} onEdit={day => setEditing({ person: current, day })} /> : <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full border-collapse text-sm"><thead className="bg-muted/60"><tr><th className="sticky left-0 z-10 min-w-40 bg-muted p-3 text-left">Collaboratore</th>{days.map(day => <th key={day} className="min-w-12 border-l px-1 py-3"><span className="block text-[10px] font-medium text-muted-foreground">{new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "short" })}</span>{Number(day.slice(-2))}</th>)}</tr></thead><tbody>{all.map(p => <tr key={p.id} className="border-t"><th className="sticky left-0 z-10 bg-card p-3 text-left"><Button variant="link" className="h-auto max-w-48 whitespace-normal break-words p-0 text-left text-foreground" onClick={() => setSelected(p.id)}>{fullName(p)}</Button></th>{days.map(day => {
      const entry = lookup.get(`${p.id}:${day}`); const state = SHIFT_STATUSES.find(s => s.value === entry?.status);
      return <td key={day} className="border-l p-1"><Button variant="ghost" className={cn("h-10 w-full border", state?.className ?? "border-transparent")} aria-label={`${fullName(p)}, ${day}${state ? `: ${state.label}` : ""}`} title={entry?.note || state?.label} onClick={() => setEditing({ person: p, day })}><span className={cn("size-2.5 rounded-full", state?.dot ?? "bg-muted")} />{entry?.note && <span className="text-[10px]">•</span>}</Button></td>;
    })}</tr>)}</tbody></table></div>}
    {all.length > 0 && <section className="mt-8 border-t pt-6"><h2 className="mb-4 text-lg font-semibold">Staff e link personali</h2><ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{all.map(p => <li key={p.id} className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-l-4 border-l-info bg-card p-4"><div className="min-w-0 space-y-1"><p className="break-words font-semibold">{fullName(p)}</p><p className="break-words text-sm text-info">{p.staff_role || "Ruolo non indicato"}</p>{p.contact_email ? <a className="block break-all text-sm underline-offset-2 hover:underline" href={`mailto:${p.contact_email}`}>{p.contact_email}</a> : <p className="text-sm text-muted-foreground">Email non indicata</p>}{p.staff_notes && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{p.staff_notes}</p>}<p className="text-xs text-muted-foreground">{p.active ? "Link abilitato" : "Link disattivato"}</p>{p.sheet_id ? <p className="text-xs"><a className="font-medium text-info underline-offset-2 hover:underline" href={sheetUrl(p.sheet_id)} target="_blank" rel="noreferrer">Apri foglio Google</a><span className="text-muted-foreground"> · {p.sheet_synced_at ? `sincronizzato il ${new Date(p.sheet_synced_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}` : "mai sincronizzato"}</span></p> : <Button variant="outline" size="sm" className="mt-1" disabled={busy || !p.contact_email} title={p.contact_email ? undefined : "Inserisci prima l’email nella scheda"} onClick={() => createSheet(p)}><FileSpreadsheet />Crea foglio Google</Button>}</div><div className="flex flex-wrap gap-1"><Button variant="outline" size="sm" disabled={busy} onClick={() => { if (confirm(`Generare un nuovo link per ${fullName(p)}? Il precedente non funzionerà più.`)) action({ action: "rotate", id: p.id }); }}><Link2 />Nuovo link</Button><Button variant="ghost" size="icon" title="Modifica scheda" aria-label={`Modifica ${fullName(p)}`} disabled={busy} onClick={() => setPersonDialog(p)}><Pencil /></Button><Button variant="ghost" size="icon" title={p.active ? "Disattiva link" : "Riattiva link"} aria-label={`${p.active ? "Disattiva" : "Riattiva"} ${fullName(p)}`} disabled={busy} onClick={() => action({ action: "activate", id: p.id, active: !p.active })}><Power className={p.active ? "text-info" : "text-muted-foreground"} /></Button><Button variant="ghost" size="icon" title="Elimina collaboratore" aria-label={`Elimina ${fullName(p)}`} disabled={busy} onClick={() => { if (confirm(`Eliminare ${fullName(p)} e tutte le sue disponibilità?`)) action({ action: "delete", id: p.id }); }}><Trash2 className="text-destructive" /></Button></div></li>)}</ul></section>}
    {editing && <ShiftEditDialog day={editing.day} name={fullName(editing.person)} entry={lookup.get(`${editing.person.id}:${editing.day}`)} onClose={() => setEditing(null)} onSave={async (entry: { day: string; status: ShiftStatus | null; note: string }) => {
      try { await save({ data: { ...entry, collaborator_id: editing.person.id } }); await qc.invalidateQueries({ queryKey: ["shift-entries"] }); toast.success("Disponibilità salvata"); }
      catch (error) { toast.error((error as Error).message); throw error; }
    }} />}
    {personDialog && <PersonDialog person={personDialog === "new" ? null : personDialog} busy={busy} onClose={() => setPersonDialog(null)} onSave={async (first_name, last_name, profile) => { const id = await action({ action: personDialog === "new" ? "create" : "rename", id: personDialog === "new" ? undefined : personDialog.id, first_name, last_name }); if (id && await saveProfile(id, profile)) setPersonDialog(null); }} />}
    {assignmentDialog && <AssignmentDialog day={assignmentDialog.day} personId={assignmentDialog.personId} people={all} assignments={assignments.data ?? []} onClose={() => setAssignmentDialog(null)} onHistory={(collaboratorId, day) => { setAssignmentDialog(null); setHistory({ collaboratorId, day }); }} onSave={async entry => { const r = await saveAssignment({ data: { action: "save", entry } }); await qc.invalidateQueries({ queryKey: ["shift-assignments"] }); if (r.sheetWarning) toast.warning(r.sheetWarning); else toast.success("Turno salvato"); }} onDelete={async (collaborator_id, day) => { const r = await saveAssignment({ data: { action: "delete", collaborator_id, day } }); await qc.invalidateQueries({ queryKey: ["shift-assignments"] }); if (r.sheetWarning) toast.warning(r.sheetWarning); else toast.success("Turno eliminato"); }} />}
    {planWeek && <WeekPlanner days={planWeek} people={all} entries={entries.data ?? []} assignments={(assignments.data ?? []).filter(a => planWeek.includes(a.day))} onSave={saveWeek} onPublish={() => publishRange(planWeek[0] ?? periodFirst, planWeek.at(-1) ?? periodLast, "Pubblicare i turni della settimana e inviare le mail ai collaboratori?")} onClose={() => setPlanWeek(null)} />}
    {history && <ShiftHistoryDialog collaboratorId={history.collaboratorId} day={history.day} name={fullName(all.find(p => p.id === history.collaboratorId))} onClose={() => setHistory(null)} />}
    {link && <Dialog open onOpenChange={o => !o && setLink(null)}><DialogContent><DialogHeader><DialogTitle>Link personale — {link.name}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Invialo solo al collaboratore: dal medesimo link vedrà i suoi turni con orario e potrà modificare le disponibilità. Copialo ora; non verrà conservato in chiaro.</p><Input readOnly aria-label="Link personale" value={link.url} /><Button onClick={async () => { try { await navigator.clipboard.writeText(link.url); toast.success("Link copiato"); } catch { toast.error("Seleziona e copia il link dal campo"); } }}><Copy />Copia link</Button></DialogContent></Dialog>}
  </div>;
}
function fullName(p?: Pick<Collaborator, "first_name" | "last_name">) { return p ? `${p.first_name} ${p.last_name}` : "Collaboratore"; }
type Profile = { staff_role: string; contact_email: string; staff_notes: string };
function PersonDialog({ person, busy, onClose, onSave }: { person: Collaborator | null; busy: boolean; onClose: () => void; onSave: (first: string, last: string, profile: Profile) => Promise<void> }) {
  const [first, setFirst] = useState(person?.first_name ?? ""); const [last, setLast] = useState(person?.last_name ?? "");
  const [role, setRole] = useState(person?.staff_role ?? ""); const [email, setEmail] = useState(person?.contact_email ?? ""); const [notes, setNotes] = useState(person?.staff_notes ?? "");
  async function submit(e: FormEvent) { e.preventDefault(); await onSave(first, last, { staff_role: role.trim(), contact_email: email.trim(), staff_notes: notes.trim() }); }
  return <Dialog open onOpenChange={o => !o && !busy && onClose()}><DialogContent><DialogHeader><DialogTitle>{person ? "Modifica collaboratore" : "Nuovo collaboratore"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="space-y-2"><Label htmlFor="shift-first">Nome</Label><Input id="shift-first" required maxLength={80} value={first} onChange={e => setFirst(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="shift-last">Cognome</Label><Input id="shift-last" required maxLength={80} value={last} onChange={e => setLast(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="shift-role">Ruolo</Label><Input id="shift-role" maxLength={80} placeholder="Es. Commesso, Arbitro" value={role} onChange={e => setRole(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="shift-email">Email di riferimento</Label><Input id="shift-email" type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="shift-notes">Note</Label><Textarea id="shift-notes" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} /></div><Button type="submit" disabled={busy || !first.trim() || !last.trim()}>{busy ? "Salvataggio…" : "Salva scheda"}</Button></form></DialogContent></Dialog>;
}