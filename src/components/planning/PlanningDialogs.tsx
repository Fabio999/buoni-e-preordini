import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Field, selectClass } from "@/components/forms/SimpleDialogs";
import { DateTimeField } from "./DateTimeField";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useRefresh, useTasks, usePlanningHistory } from "@/lib/data";
import { useOperator } from "@/lib/operator";
import { alternativesOf, PRIORITY, TASK_STATUS, ZONE, planningDate, toInstant, wallTime, type Task, type CalendarEntry } from "@/lib/planning";

function PeopleSuggestions() {
  const [people, setPeople] = useState<string[]>([]);
  const operator = useOperator();
  useEffect(() => { supabase.from("account_operators").select("first_name,last_name").then(({data}) => setPeople([...new Set([operator, ...(data ?? []).map(p => `${p.first_name} ${p.last_name}`)])])); }, [operator]);
  return <datalist id="planning-people">{people.map(p => <option key={p} value={p}/>)}</datalist>;
}
type Props<T> = { open: boolean; onOpenChange: (o: boolean) => void; initial?: T | null; onSaved?: (id: string) => void };
export function TaskDialog({ open, onOpenChange, initial, onSaved }: Props<Task>) {
  const operator = useOperator();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: "", description: "", starts: "", due: "", priority: "normale", mandatory: false, responsible: "", status: "da_fare" });
  useEffect(() => { if (open) setF({ title: initial?.title ?? "", description: initial?.description ?? "", starts: wallTime(initial?.starts_at ?? null), due: wallTime(initial?.due_at ?? null), priority: initial?.priority ?? "normale", mandatory: initial?.mandatory ?? false, responsible: initial?.responsible ?? operator, status: initial?.status ?? "da_fare" }); }, [open, initial, operator]);
  async function save(e: FormEvent) {
    e.preventDefault(); e.stopPropagation(); setBusy(true);
    try {
      const row = { title: f.title.trim(), description: f.description, starts_at: toInstant(f.starts), due_at: toInstant(f.due), priority: f.priority, mandatory: f.mandatory, responsible: f.responsible.trim(), status: f.status };
      const res = initial ? await supabase.from("company_tasks").update(row).eq("id", initial.id).select("id").single() : await supabase.from("company_tasks").insert(row).select("id").single();
      if (res.error) throw res.error;
      await refresh(); toast.success("Task salvata"); onOpenChange(false); onSaved?.(res.data.id);
    } catch (error) { toast.error(errMsg(error)); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{initial ? "Modifica task" : "Nuova task"}</DialogTitle><DialogDescription>Date e orari · Italia (Europe/Rome)</DialogDescription></DialogHeader>
    <form onSubmit={save} className="space-y-4"><Field label="Titolo"><Input aria-label="Titolo task" required value={f.title} onChange={e => setF({...f, title: e.target.value})}/></Field><Field label="Descrizione"><Textarea aria-label="Descrizione task" value={f.description} onChange={e => setF({...f, description: e.target.value})}/></Field>
      <div className="grid gap-4 sm:grid-cols-2"><DateTimeField label="Inizio previsto" value={f.starts} onChange={starts => setF({...f, starts})}/><DateTimeField label="Scadenza" value={f.due} onChange={due => setF({...f, due})}/></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Priorità"><select className={selectClass} aria-label="Priorità task" value={f.priority} onChange={e => setF({...f, priority: e.target.value})}>{Object.entries(PRIORITY).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field><Field label="Stato"><select className={selectClass} aria-label="Stato task" value={f.status} onChange={e => setF({...f, status: e.target.value})}>{Object.entries(TASK_STATUS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field></div>
      <Field label="Responsabile · nome e cognome"><Input list="planning-people" aria-label="Responsabile task" value={f.responsible} onChange={e => setF({...f, responsible: e.target.value})}/><PeopleSuggestions/></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={f.mandatory} onChange={e => setF({...f, mandatory: e.target.checked})}/>Attività obbligatoria</label>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button><Button disabled={busy} type="submit">Salva task</Button></DialogFooter>
    </form></DialogContent></Dialog>;
}

export function CalendarDialog({ open, onOpenChange, initial, onSaved, initialDate }: Props<CalendarEntry> & { initialDate?: string | undefined }) {
  const refresh = useRefresh(); const { data: tasks = [] } = useTasks(); const operator = useOperator();
  const [busy, setBusy] = useState(false); const [createTask, setCreateTask] = useState(false);
  const [f,setF] = useState({ title: "", description: "", start: "", end: "", zone: ZONE, names: "", task: "", confirmed: false, alternatives: [] as {start: string; end: string}[] });
  useEffect(() => { if(open) { const day = initialDate ?? wallTime(new Date().toISOString()).slice(0,10); const zone = initial?.timezone ?? ZONE; setF({title: initial?.title ?? "", description: initial?.description ?? "", start: initial ? wallTime(initial.starts_at, zone) : `${day}T09:00`, end: initial ? wallTime(initial.ends_at, zone) : `${day}T10:00`, zone, names: initial?.responsible_names.join("\n") ?? operator, task: initial?.task_id ?? "", confirmed: initial?.confirmed ?? false, alternatives: initial ? alternativesOf(initial).map(a => ({start: wallTime(a.starts_at, zone), end: wallTime(a.ends_at, zone)})) : []}); } }, [open, initial, initialDate, operator]);
  async function save(e: FormEvent) {
    e.preventDefault(); e.stopPropagation(); setBusy(true);
    try {
      const start = toInstant(f.start,f.zone), end = toInstant(f.end,f.zone);
      if (!start || !end) throw new Error("Scegli data e ora di inizio e fine");
      const alternatives = f.alternatives.map(a => { const starts_at = toInstant(a.start,f.zone), ends_at = toInstant(a.end,f.zone); if(!starts_at || !ends_at) throw new Error("Completa le date alternative"); return {starts_at, ends_at}; });
      const row = {title:f.title.trim(), description:f.description, starts_at:start, ends_at:end, timezone:f.zone, responsible_names:[...new Set(f.names.split(/\n|;/).map(n => n.trim()).filter(Boolean))], task_id:f.task || null, confirmed:f.confirmed, alternatives};
      const res = initial ? await supabase.from("calendar_entries").update(row).eq("id",initial.id).select("id").single() : await supabase.from("calendar_entries").insert(row).select("id").single();
      if(res.error) throw res.error; await refresh(); toast.success("Evento salvato"); onOpenChange(false); onSaved?.(res.data.id);
    } catch(error) {toast.error(errMsg(error));} finally {setBusy(false);}
  }
  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{initial ? "Modifica appuntamento" : "Nuovo appuntamento"}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={save}><Field label="Titolo"><Input required aria-label="Titolo appuntamento" value={f.title} onChange={e => setF({...f,title:e.target.value})}/></Field><Field label="Descrizione"><Textarea aria-label="Descrizione appuntamento" value={f.description} onChange={e => setF({...f,description:e.target.value})}/></Field>
      <Field label="Fuso orario"><select aria-label="Fuso orario" className={selectClass} value={f.zone} onChange={e => { const zone = e.target.value; setF({...f, zone, start: wallTime(toInstant(f.start,f.zone),zone), end:wallTime(toInstant(f.end,f.zone),zone), alternatives:f.alternatives.map(a => ({start:wallTime(toInstant(a.start,f.zone),zone),end:wallTime(toInstant(a.end,f.zone),zone)}))}); }}>{[...new Set([ZONE,"Europe/London","America/New_York","UTC",f.zone])].map(z => <option key={z}>{z}</option>)}</select></Field>
      <div className="grid gap-4 sm:grid-cols-2"><DateTimeField required label="Inizio evento" value={f.start} onChange={start => setF({...f,start})}/><DateTimeField required label="Fine evento" value={f.end} onChange={end => setF({...f,end})}/></div>
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Date alternative</h3><Button variant="outline" size="sm" type="button" onClick={() => setF({...f,alternatives:[...f.alternatives,{start:f.start,end:f.end}]})}><Plus className="size-4"/>Aggiungi data</Button></div>
      {f.alternatives.map((a,i) => <div key={i} className="space-y-2 border-l-2 border-info pl-3"><div className="grid gap-3 sm:grid-cols-2"><DateTimeField required label={`Alternativa ${i+1}: inizio`} value={a.start} onChange={start => setF({...f,alternatives:f.alternatives.map((x,j) => j===i ? {...x,start} : x)})}/><DateTimeField required label={`Alternativa ${i+1}: fine`} value={a.end} onChange={end => setF({...f,alternatives:f.alternatives.map((x,j) => j===i ? {...x,end} : x)})}/></div><Button type="button" size="sm" variant="ghost" onClick={() => { const alternatives=[...f.alternatives]; if(!alternatives.some(x => x.start===f.start && x.end===f.end)) alternatives.push({start:f.start,end:f.end}); setF({...f,start:a.start,end:a.end,confirmed:true,alternatives}); }}>Scegli come definitiva</Button><Button type="button" size="icon" variant="ghost" aria-label={`Elimina alternativa ${i+1}`} onClick={() => setF({...f,alternatives:f.alternatives.filter((_,j) => j!==i)})}><Trash2 className="size-4"/></Button></div>)}
      <Field label="Responsabili · un nome e cognome per riga"><Textarea aria-label="Responsabili appuntamento" value={f.names} onChange={e => setF({...f,names:e.target.value})}/></Field>
      <Field label="Task collegata"><div className="flex gap-2"><select aria-label="Task collegata" className={selectClass} value={f.task} onChange={e => setF({...f,task:e.target.value})}><option value="">Nessuna task</option>{tasks.filter(t => !t.archived || t.id===f.task).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select><Button type="button" variant="outline" size="icon" title="Crea task" aria-label="Crea task dal calendario" onClick={() => setCreateTask(true)}><Plus className="size-4"/></Button></div></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={f.confirmed} onChange={e => setF({...f,confirmed:e.target.checked})}/>Data confermata</label>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button><Button type="submit" disabled={busy}>Salva evento</Button></DialogFooter>
    </form></DialogContent></Dialog><TaskDialog open={createTask} onOpenChange={setCreateTask} onSaved={id => setF({...f,task:id})}/></>;
}

const labels: Record<string,string> = { title:"Titolo",description:"Descrizione",starts_at:"Inizio previsto",due_at:"Scadenza",ends_at:"Fine",priority:"Priorità",mandatory:"Obbligatorietà",responsible:"Responsabile",responsible_names:"Responsabili",status:"Stato",alternatives:"Date alternative",confirmed:"Data confermata",archived:"Archiviata",task_id:"Task collegata",timezone:"Fuso orario",claimed_by:"Presa in carico da",claimed_at:"Presa in carico il",started_by:"Iniziata da",started_at:"Iniziata il",completed_by:"Completata da",completed_at:"Completata il" };
function describeValue(key:string, value: unknown): string {
  if(value === null || value === undefined || value === "") return "—";
  if(key.endsWith("_at") && typeof value === "string") return planningDate(value);
  if(key === "status") return TASK_STATUS[value as keyof typeof TASK_STATUS] ?? String(value);
  if(key === "priority") return PRIORITY[value as keyof typeof PRIORITY] ?? String(value);
  if(typeof value === "boolean") return value ? "Sì" : "No";
  if(Array.isArray(value)) return value.map(v => typeof v === "object" && v ? `${planningDate(v.starts_at)} – ${planningDate(v.ends_at)}` : String(v)).join(", ") || "—";
  return String(value);
}
export function HistoryDialog({ type, id, open, onOpenChange }: {type:string;id:string;open:boolean;onOpenChange:(o:boolean)=>void}) {
  const {data = [], isLoading, error} = usePlanningHistory(type,open ? id : "");
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Cronologia {type === "task" ? "task" : "evento"}</DialogTitle></DialogHeader>
    {isLoading ? <p>Caricamento…</p> : error ? <p className="text-destructive">{errMsg(error)}</p> : !data.length ? <p>Nessuna modifica registrata.</p> : <ol className="divide-y">{data.map(h => {const before = h.before_data as Record<string, unknown> | null; const after = h.after_data as Record<string,unknown> | null; return <li key={h.id} className="space-y-2 py-4"><div className="flex flex-wrap justify-between gap-1 text-sm"><strong>{({creazione:"Creazione",modifica:"Modifica",cambio_stato:"Cambio stato",archiviazione:"Archiviazione",ripristino:"Ripristino",eliminazione:"Eliminazione"} as Record<string,string>)[h.action]}</strong><span className="text-muted-foreground">{planningDate(h.created_at)}</span></div><p className="text-sm">{h.operator_name || "Operatore non indicato"}</p>{Object.entries(labels).filter(([k]) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])).map(([k,l]) => <p key={k} className="break-words text-xs"><strong>{l}:</strong> {before && `${describeValue(k,before[k])} → `}{describeValue(k,after?.[k])}</p>)}</li>;})}</ol>}
  </DialogContent></Dialog>;
}