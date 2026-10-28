import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateEventDescription } from "@/lib/task-ai.functions";
import { EventGameField } from "./EventGameField";
import { TaskChecklist } from "./TaskChecklist";
import { taskChecklist, saveTaskChecklist, type TaskChecklistItem } from "@/lib/task-checklist";
import { TaskPeopleField } from "./TaskPeopleField";
import { TaskWorkflowEditor } from "./TaskWorkflow";
import { TaskOptionField } from "./TaskOptionField";
import { DEFAULT_TASK_STAGES, taskStages, positionForStatus } from "@/lib/task-workflow";
import { formatTaskPeople } from "@/lib/task-people";
import { occurrenceDates, recurrenceTargets, recurrenceColorUpdates, alignWeekday, WEEKDAYS, RECURRENCE, rememberGame } from "@/lib/event-recurrence";
import { useAuth } from "@/lib/auth";
import { EVENT_COLORS } from "@/lib/planning";
import { cn } from "@/lib/utils";
import { EVENT_DETAIL_FIELDS, emptyEventDetails, parseEventDescription, formatEventDescription, type EventDetails } from "@/lib/event-details";
import { EventDetailsList } from "./EventDetailsList";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Field, selectClass } from "@/components/forms/SimpleDialogs";
import { DateTimeField } from "./DateTimeField";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { errMsg, useRefresh, useTasks, useCalendarEntries, usePlanningHistory } from "@/lib/data";
import { type TaskSeed } from "@/lib/task-drafts";
import { useOperator } from "@/lib/operator";
import { alternativesOf, PRIORITY, TASK_STATUS, ZONE, planningDate, toInstant, wallTime, type Task, type CalendarEntry } from "@/lib/planning";

function PeopleSuggestions() {
  const [people, setPeople] = useState<string[]>([]);
  const operator = useOperator();
  useEffect(() => { supabase.from("account_operators").select("first_name,last_name").then(({data}) => setPeople([...new Set([operator, ...(data ?? []).map(p => `${p.first_name} ${p.last_name}`)])])); }, [operator]);
  return <datalist id="planning-people">{people.map(p => <option key={p} value={p}/>)}</datalist>;
}
type Props<T> = { open: boolean; onOpenChange: (o: boolean) => void; initial?: T | null; onSaved?: (id: string) => void };
export function TaskDialog({ open, onOpenChange, initial, onSaved, draft }: Props<Task> & { draft?: TaskSeed | null }) {
  const operator = useOperator();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [stages, setStages] = useState<string[]>(DEFAULT_TASK_STAGES);
  const [f, setF] = useState({ title: "", category: "", game: "", location: "", description: "", starts: "", due: "", priority: "normale", mandatory: false, responsible: "", status: "da_fare", source_description: "" });
  useEffect(() => { if (open) { setChecklist(taskChecklist(initial?.checklist)); setStages(initial ? taskStages(initial.workflow_stages) : [...DEFAULT_TASK_STAGES]); setF({ title: initial?.title ?? draft?.title ?? "", category: initial?.category ?? "", game: initial?.game ?? "", location: initial?.location ?? "", description: initial?.description ?? draft?.description ?? "", starts: wallTime(initial?.starts_at ?? null), due: wallTime(initial?.due_at ?? null), priority: initial?.priority ?? "normale", mandatory: initial?.mandatory ?? false, responsible: initial?.responsible ?? operator, status: initial?.status ?? "da_fare", source_description: initial?.source_description ?? draft?.source_description ?? "" }); } }, [open, initial, operator, draft]);
  async function save(e: FormEvent) {
    e.preventDefault(); e.stopPropagation(); setBusy(true);
    try {
      const cleanStages = taskStages(stages);
      const row = { checklist: saveTaskChecklist(checklist), title: f.title.trim(), category: f.category.trim(), game: f.game.trim(), location: f.location.trim(), workflow_stages: cleanStages, workflow_position: positionForStatus(cleanStages, initial?.workflow_position ?? 0, f.status), description: f.description, starts_at: toInstant(f.starts), due_at: toInstant(f.due), priority: f.priority, mandatory: f.mandatory, responsible: formatTaskPeople(f.responsible), status: f.status, source_description:f.source_description };
      const res = initial ? await supabase.from("company_tasks").update(row).eq("id", initial.id).select("id").single() : await supabase.from("company_tasks").insert(row).select("id").single();
      if (res.error) throw res.error;
      await refresh(); toast.success("Task salvata"); onOpenChange(false); onSaved?.(res.data.id);
    } catch (error) { toast.error(errMsg(error)); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{initial ? "Modifica task" : "Nuova task"}</DialogTitle><DialogDescription>Date e orari · Italia (Europe/Rome)</DialogDescription></DialogHeader>
    <form onSubmit={save} className="space-y-4"><TaskOptionField kind="category" open={open} value={f.category} onChange={category => setF({...f, category})}/><TaskOptionField kind="game" open={open} value={f.game} onChange={game => setF({...f, game})}/><Field label="Dettagli"><Textarea aria-label="Descrizione task" value={f.description} onChange={e => setF({...f, description: e.target.value})}/></Field><Field label="Titolo"><Input aria-label="Titolo task" required value={f.title} onChange={e => setF({...f, title: e.target.value})}/></Field><Field label="Luogo"><Input aria-label="Luogo task" value={f.location} onChange={e => setF({...f, location: e.target.value})}/></Field><TaskWorkflowEditor stages={stages} onChange={setStages}/><TaskChecklist editing items={checklist} onChange={setChecklist}/>
      {f.source_description && <Field label="Descrizione originale"><Textarea aria-label="Descrizione originale" value={f.source_description} onChange={e => setF({...f,source_description:e.target.value})}/></Field>}
      <div className="grid gap-4 sm:grid-cols-2"><DateTimeField label="Inizio previsto" value={f.starts} onChange={starts => setF({...f, starts})}/><DateTimeField label="Scadenza" value={f.due} onChange={due => setF({...f, due})}/></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Priorità"><select className={selectClass} aria-label="Priorità task" value={f.priority} onChange={e => setF({...f, priority: e.target.value})}>{Object.entries(PRIORITY).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field><Field label="Stato"><select className={selectClass} aria-label="Stato task" value={f.status} onChange={e => setF({...f, status: e.target.value})}>{Object.entries(TASK_STATUS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field></div>
      <TaskPeopleField value={f.responsible} onChange={responsible => setF({...f, responsible})}/><PeopleSuggestions/>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={f.mandatory} onChange={e => setF({...f, mandatory: e.target.checked})}/>Attività obbligatoria</label>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button><Button disabled={busy} type="submit">Salva task</Button></DialogFooter>
    </form></DialogContent></Dialog>;
}

export function CalendarDialog({ open, onOpenChange, initial, onSaved, initialDate, onDelete }: Props<CalendarEntry> & { initialDate?: string | undefined; onDelete?: (event: CalendarEntry) => void }) {
  const { session } = useAuth();
  const [recurrence, setRecurrence] = useState("");
  const [count, setCount] = useState(4);
  const [weekday, setWeekday] = useState("");
  const [following, setFollowing] = useState(false);
  const { data: events = [] } = useCalendarEntries();
  const refresh = useRefresh(); const { data: tasks = [] } = useTasks(); const operator = useOperator();
  const [busy, setBusy] = useState(false); const [createTask, setCreateTask] = useState(false); const [aiBusy, setAiBusy] = useState(false); const describe = useServerFn(generateEventDescription);
  const [details, setDetails] = useState<EventDetails>(() => emptyEventDetails(true));
  const [f,setF] = useState({ title: "", game: "", description: "", color: "blu", reminder: "", reminderText: "", start: "", end: "", zone: ZONE, names: "", task: "", confirmed: false, alternatives: [] as {start: string; end: string}[] });
  useEffect(() => { if(open) { setRecurrence(initial?.recurrence_frequency ?? ""); setCount(4); setWeekday(""); setFollowing(false); const day = initialDate ?? wallTime(new Date().toISOString()).slice(0,10); const zone = initial?.timezone ?? ZONE; const parsed = parseEventDescription(initial?.description); setDetails(initial ? parsed.details : emptyEventDetails(true)); setF({title: initial?.title ?? "", game: initial?.game ?? "", description: parsed.notes, color: initial?.color ?? "blu", reminder: initial?.reminder_minutes == null ? "" : String(initial.reminder_minutes), reminderText: initial?.reminder_text ?? "", start: initial ? wallTime(initial.starts_at, zone) : `${day}T09:00`, end: initial ? wallTime(initial.ends_at, zone) : `${day}T10:00`, zone, names: initial?.responsible_names.join("\n") ?? operator, task: initial?.task_id ?? "", confirmed: initial?.confirmed ?? false, alternatives: initial ? alternativesOf(initial).map(a => ({start: wallTime(a.starts_at, zone), end: wallTime(a.ends_at, zone)})) : []}); } }, [open, initial, initialDate, operator]);
  async function save(e: FormEvent) {
    e.preventDefault(); e.stopPropagation(); setBusy(true);
    try {
      const start = toInstant(f.start,f.zone), end = toInstant(f.end,f.zone);
      if (!start || !end) throw new Error("Scegli data e ora di inizio e fine");
      const alternatives = f.alternatives.map(a => { const starts_at = toInstant(a.start,f.zone), ends_at = toInstant(a.end,f.zone); if(!starts_at || !ends_at) throw new Error("Completa le date alternative"); return {starts_at, ends_at}; });
      const row = {title:f.title.trim(), game:f.game.trim(), description:formatEventDescription(details, f.description), color:f.color, reminder_minutes:f.reminder === "" ? null : Number(f.reminder), reminder_text:f.reminderText.trim(), starts_at:start, ends_at:end, timezone:f.zone, responsible_names:[...new Set(f.names.split(/\n|;/).map(n => n.trim()).filter(Boolean))], task_id:f.task || null, confirmed:f.confirmed, alternatives};
      let savedId: string;
      if (initial) {
        const targets = recurrenceTargets(events, initial, following);
        const dates = occurrenceDates(f.start, f.end, f.zone, recurrence, initial.recurrence_series ? targets.length : count, weekday === "" ? undefined : Number(weekday));
        const series = recurrence ? initial.recurrence_series ?? crypto.randomUUID() : null;
        const rows: TablesInsert<"calendar_entries">[] = initial.recurrence_series ? targets.map((event, index) => ({...event, ...(event.id === initial.id ? row : {}), ...(recurrence ? dates[index] : {starts_at:event.id === initial.id ? start : event.starts_at, ends_at:event.id === initial.id ? end : event.ends_at}), id:event.id, recurrence_series:series, recurrence_frequency:recurrence || null, alternatives:event.id === initial.id ? alternatives : event.alternatives})) : dates.map((date,index) => ({...row, ...date, ...(index === 0 ? {id:initial.id} : {}), recurrence_series:series, recurrence_frequency:recurrence || null, alternatives:index === 0 ? alternatives : []}));
        const colorRows = recurrenceColorUpdates(events, initial, f.color);
        const colorIds = new Set(colorRows.map(event => event.id));
        const savedRows = rows.map(event => colorIds.has(event.id ?? "") ? {...event, color:f.color} : event);
        const savedIds = new Set(rows.map(event => event.id));
        savedRows.push(...colorRows.filter(event => !savedIds.has(event.id)));
        const res = await supabase.from("calendar_entries").upsert(savedRows).select("id");
        if (res.error) throw res.error;
        savedId = initial.id;
      } else {
        const dates = occurrenceDates(f.start, f.end, f.zone, recurrence, count, weekday === "" ? undefined : Number(weekday));
        const series = recurrence ? crypto.randomUUID() : null;
        const rows = dates.map((date, i) => ({...row, ...date, recurrence_series:series, recurrence_frequency:recurrence || null, alternatives:i === 0 ? alternatives : []}));
        const res = await supabase.from("calendar_entries").insert(rows).select("id");
        if (res.error) throw res.error;
        const first = res.data[0];
        if (!first) throw new Error("Evento non salvato");
        savedId = first.id;
      }
      if (session) rememberGame(session.user.id, row.game);
      await refresh(); toast.success(!initial && recurrence ? `${count} eventi salvati` : "Evento salvato"); onOpenChange(false); onSaved?.(savedId);
    } catch(error) {toast.error(errMsg(error));} finally {setBusy(false);}
  }
  async function writeDescription() {
    if (f.title.trim().length < 3) { toast.error("Scrivi prima il titolo dell'evento"); return; }
    setAiBusy(true);
    try { const res = await describe({ data: { title: f.title.trim(), notes: formatEventDescription(details, f.description).slice(0, 1000) } }); if (res.error || !res.description) toast.error(res.error ?? "Descrizione non disponibile"); else { const parsed = parseEventDescription(res.description); setF(prev => ({...prev, description: parsed.notes})); toast.success("Descrizione scritta"); } }
    catch (error) { toast.error(errMsg(error)); } finally { setAiBusy(false); }
  }
  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{initial ? "Modifica appuntamento" : "Nuovo appuntamento"}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={save}>
      {<section className="space-y-3 border-y py-4"><h3 className="font-semibold">Evento ricorrente</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Ripeti evento"><select className={selectClass} aria-label="Ripeti evento" value={recurrence} onChange={e => { setRecurrence(e.target.value); setWeekday(""); if (initial?.recurrence_series) setFollowing(true); }}><option value="">Non ripetere</option>{Object.entries(RECURRENCE).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>{recurrence && !initial?.recurrence_series && <Field label="Numero di appuntamenti (incluso il primo)"><Input type="number" min={1} max={52} required aria-label="Numero di appuntamenti" value={count} onChange={e => setCount(Number(e.target.value))}/></Field>}</div>{(recurrence === "weekly" || recurrence === "fortnightly") && <Field label="Giorno fisso della settimana"><select className={selectClass} aria-label="Giorno fisso della settimana" value={weekday === "" ? String(new Date(`${f.start.slice(0,10)}T12:00`).getDay()) : weekday} onChange={e => { setWeekday(e.target.value); if (initial?.recurrence_series) setFollowing(true); const dates = alignWeekday(f.start, f.end, Number(e.target.value)); setF({...f, ...dates}); }}>{WEEKDAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select>{f.start && f.end && <p className="mt-2 text-sm text-muted-foreground">Prima data: {wallTime(toInstant(alignWeekday(f.start, f.end, weekday === "" ? new Date(`${f.start.slice(0,10)}T12:00`).getDay() : Number(weekday)).start, f.zone), f.zone).slice(0,10).split("-").reverse().join("/")}</p>}</Field>}{initial?.recurrence_series && <Field label="Applica modifiche a"><select className={selectClass} aria-label="Applica modifiche a" value={following ? "following" : "single"} onChange={e => setFollowing(e.target.value === "following")}><option value="single">Solo questo appuntamento</option><option value="following">Questo e i successivi della serie</option></select></Field>}</section>}
<Field label="Titolo"><Input required aria-label="Titolo appuntamento" value={f.title} onChange={e => setF({...f,title:e.target.value})}/></Field><EventGameField open={open} value={f.game} onChange={game => setF({...f,game})}/><Field label="Descrizione"><div className="space-y-2"><Textarea aria-label="Descrizione appuntamento" placeholder="Facoltativo: scrivi qualche appunto e premi «Scrivi con AI»" value={f.description} onChange={e => setF({...f,description:e.target.value})}/><Button type="button" variant="outline" size="sm" disabled={aiBusy} onClick={writeDescription}><Sparkles className="size-4"/>{aiBusy ? "Sto scrivendo…" : "Scrivi con AI"}</Button></div></Field>
      <section className="space-y-3 border-y py-4"><h3 className="font-semibold">Dettagli evento</h3><div className="grid gap-3 sm:grid-cols-2">{EVENT_DETAIL_FIELDS.map(field => <Field key={field.key} label={`${field.emoji} ${field.label}`}><Input aria-label={field.label} placeholder={field.placeholder} value={details[field.key]} onChange={e => setDetails(prev => ({...prev,[field.key]:e.target.value}))}/></Field>)}</div></section>
      <section className="space-y-2"><h3 className="text-sm font-semibold">Riepilogo evento</h3><EventDetailsList details={details}/></section>
      <Field label="Colore"><div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Colore evento">{EVENT_COLORS.map(c => <Button key={c.value} type="button" variant="outline" role="radio" aria-checked={f.color===c.value} aria-label={c.label} title={c.label} onClick={() => setF({...f,color:c.value})} className={cn("h-11 justify-start px-3", f.color===c.value && "ring-2 ring-ring bg-accent")}><span className={cn("size-5 shrink-0 rounded-full", c.dot)}/>{c.label}</Button>)}</div></Field>
      <Field label="Fuso orario"><select aria-label="Fuso orario" className={selectClass} value={f.zone} onChange={e => { const zone = e.target.value; setF({...f, zone, start: wallTime(toInstant(f.start,f.zone),zone), end:wallTime(toInstant(f.end,f.zone),zone), alternatives:f.alternatives.map(a => ({start:wallTime(toInstant(a.start,f.zone),zone),end:wallTime(toInstant(a.end,f.zone),zone)}))}); }}>{[...new Set([ZONE,"Europe/London","America/New_York","UTC",f.zone])].map(z => <option key={z}>{z}</option>)}</select></Field>
      <div className="grid gap-4 sm:grid-cols-2"><DateTimeField required label="Inizio evento" value={f.start} onChange={start => setF({...f,start})}/><DateTimeField required label="Fine evento" value={f.end} onChange={end => setF({...f,end})}/></div>

      {initial?.recurrence_series && <p className="text-sm text-muted-foreground">Appuntamento ricorrente · {following ? "modifica di questa data e delle successive" : "modifica solo di questa data"}</p>}
      <section className="space-y-3 border-y py-4"><h3 className="font-semibold">Promemoria evento</h3><Field label="Quando avvisare"><select className={selectClass} aria-label="Anticipo promemoria evento" value={f.reminder} onChange={e => setF({...f,reminder:e.target.value})}><option value="">Disattivato</option>{[...new Set([0,5,15,30,60,120,1440,2880,10080,...(f.reminder ? [Number(f.reminder)] : [])])].sort((a,b) => a-b).map(minutes => <option key={minutes} value={minutes}>{minutes === 0 ? "All'inizio dell'evento" : minutes < 60 ? `${minutes} minuti prima` : minutes < 1440 ? `${minutes/60} ore prima` : `${minutes/1440} giorni prima`}</option>)}</select></Field>{f.reminder !== "" && <Field label="Testo del promemoria (facoltativo)"><Textarea aria-label="Testo promemoria evento" placeholder="Prepara premi, promo e materiale…" value={f.reminderText} onChange={e => setF({...f,reminderText:e.target.value})}/></Field>}</section>
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Date alternative</h3><Button variant="outline" size="sm" type="button" onClick={() => setF({...f,alternatives:[...f.alternatives,{start:f.start,end:f.end}]})}><Plus className="size-4"/>Aggiungi data</Button></div>
      {f.alternatives.map((a,i) => <div key={i} className="space-y-2 border-l-2 border-info pl-3"><div className="grid gap-3 sm:grid-cols-2"><DateTimeField required label={`Alternativa ${i+1}: inizio`} value={a.start} onChange={start => setF({...f,alternatives:f.alternatives.map((x,j) => j===i ? {...x,start} : x)})}/><DateTimeField required label={`Alternativa ${i+1}: fine`} value={a.end} onChange={end => setF({...f,alternatives:f.alternatives.map((x,j) => j===i ? {...x,end} : x)})}/></div><Button type="button" size="sm" variant="ghost" onClick={() => { const alternatives=[...f.alternatives]; if(!alternatives.some(x => x.start===f.start && x.end===f.end)) alternatives.push({start:f.start,end:f.end}); setF({...f,start:a.start,end:a.end,confirmed:true,alternatives}); }}>Scegli come definitiva</Button><Button type="button" size="icon" variant="ghost" aria-label={`Elimina alternativa ${i+1}`} onClick={() => setF({...f,alternatives:f.alternatives.filter((_,j) => j!==i)})}><Trash2 className="size-4"/></Button></div>)}
      <Field label="Responsabili · un nome e cognome per riga"><Textarea aria-label="Responsabili appuntamento" value={f.names} onChange={e => setF({...f,names:e.target.value})}/></Field>
      <Field label="Task collegata"><div className="flex gap-2"><select aria-label="Task collegata" className={selectClass} value={f.task} onChange={e => setF({...f,task:e.target.value})}><option value="">Nessuna task</option>{tasks.filter(t => !t.archived || t.id===f.task).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select><Button type="button" variant="outline" size="icon" title="Crea task" aria-label="Crea task dal calendario" onClick={() => setCreateTask(true)}><Plus className="size-4"/></Button></div></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={f.confirmed} onChange={e => setF({...f,confirmed:e.target.checked})}/>Data confermata</label>
      <DialogFooter>{initial && onDelete && <Button type="button" variant="destructive" disabled={busy || aiBusy} onClick={() => onDelete(initial)}><Trash2 className="size-4"/>Elimina evento</Button>}<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button><Button type="submit" disabled={busy}>Salva evento</Button></DialogFooter>
    </form></DialogContent></Dialog><TaskDialog open={createTask} onOpenChange={setCreateTask} onSaved={id => setF({...f,task:id})}/></>;
}

const labels: Record<string,string> = { checklist:"Checklist",title:"Titolo",category:"Categoria",location:"Luogo",workflow_stages:"Fasi",workflow_position:"Fasi completate",game:"Gioco",recurrence_frequency:"Ripetizione",description:"Descrizione",source_description:"Descrizione originale",starts_at:"Inizio previsto",due_at:"Scadenza",ends_at:"Fine",priority:"Priorità",mandatory:"Obbligatorietà",responsible:"Responsabile",responsible_names:"Responsabili",status:"Stato",alternatives:"Date alternative",confirmed:"Data confermata",archived:"Archiviata",task_id:"Task collegata",timezone:"Fuso orario",reminder_minutes:"Anticipo promemoria (minuti)",reminder_text:"Testo promemoria",claimed_by:"Presa in carico da",claimed_at:"Presa in carico il",started_by:"Iniziata da",started_at:"Iniziata il",completed_by:"Completata da",completed_at:"Completata il" };
function describeValue(key:string, value: unknown): string {
  if(value === null || value === undefined || value === "") return "—";
  if(key === "checklist") return taskChecklist(value).map(item => `${item.done ? "✓" : "☐"} ${item.text}`).join("; ") || "—";
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