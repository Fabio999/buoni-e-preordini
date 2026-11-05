import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { History, Maximize2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ASSIGNMENT_STATUSES, assignmentInputSchema, assignmentMinutes, assignmentTime, compactTime, formatHours, monthDays, type Collaborator, type ShiftAssignment } from "@/lib/shifts";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<ShiftAssignment["status"], string> = { pubblicato: "bg-success", bozza: "border border-dashed border-muted-foreground bg-transparent", modificato: "bg-warning" };
export function ShiftSchedule({ month, days, assignments, people, onEdit }: { month: string; days?: string[] | undefined; assignments: ShiftAssignment[]; people: Collaborator[]; onEdit?: (day: string, collaboratorId?: string) => void }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const today = formatInTimeZone(new Date(), "Europe/Rome", "yyyy-MM-dd");
  const names = new Map(people.map(p => [p.id, `${p.first_name} ${p.last_name}`]));
  const short = new Map(people.map(p => [p.id, `${p.first_name} ${p.last_name.slice(0, 1)}.`]));
  const list = days ?? monthDays(month);
  const single = list.length === 1;
  const showNames = people.length > 1;
  const headers = single ? [format(new Date(`${list[0]}T12:00:00`), "EEEE", { locale: it })] : ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  const ofDay = (day: string) => assignments.filter(e => e.day === day).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return <><div className="overflow-x-auto rounded-lg border bg-card"><div className={single ? "" : "min-w-[560px]"}><div className={cn("grid border-b bg-muted/60", single ? "grid-cols-1" : "grid-cols-7")}>{headers.map(day => <div key={day} className="py-3 text-center text-xs font-semibold capitalize text-muted-foreground">{day}</div>)}</div><div className={cn("grid", single ? "grid-cols-1" : "grid-cols-7")}>{list.map(day => {
    const shifts = ofDay(day);
    return <div key={day} className={cn("group min-h-24 min-w-0 cursor-pointer border-b border-r p-1.5 transition-colors hover:bg-muted/40", !days && !day.startsWith(month) && "opacity-45", day === today && "bg-primary/5 ring-1 ring-inset ring-primary")} onClick={() => setZoom(day)}>
      <div className="mb-1 flex items-center justify-between"><button type="button" className="rounded px-1 text-xs font-semibold hover:bg-muted" aria-label={`Apri ${day}`} onClick={e => { e.stopPropagation(); setZoom(day); }}>{Number(day.slice(-2))}</button>{shifts.length > 0 && <Maximize2 className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}</div>
      <ul className="space-y-0.5">{shifts.map(entry => {
        const status = ASSIGNMENT_STATUSES.find(s => s.value === entry.status);
        const content = <><span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[entry.status])} />{showNames && <span className="min-w-0 truncate">{short.get(entry.collaborator_id)}</span>}<span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{compactTime(entry)}</span></>;
        const title = `${names.get(entry.collaborator_id) ?? ""} · ${assignmentTime(entry)} · ${status?.label ?? ""}`;
        return <li key={entry.id}>{onEdit ? <button type="button" title={title} className={cn("flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-none hover:bg-muted", entry.status !== "pubblicato" && status?.className, entry.status !== "pubblicato" && "border")} onClick={e => { e.stopPropagation(); onEdit(day, entry.collaborator_id); }}>{content}</button> : <div title={title} className={cn("flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-none", entry.status !== "pubblicato" && status?.className, entry.status !== "pubblicato" && "border")}>{content}</div>}</li>;
      })}</ul>
    </div>;
  })}</div></div></div>
  {zoom && <DayDialog day={zoom} shifts={ofDay(zoom)} names={names} onClose={() => setZoom(null)} onEdit={onEdit ? collaboratorId => { setZoom(null); onEdit(zoom, collaboratorId); } : undefined} />}</>;
}

function DayDialog({ day, shifts, names, onClose, onEdit }: { day: string; shifts: ShiftAssignment[]; names: Map<string, string>; onClose: () => void; onEdit?: ((collaboratorId?: string) => void) | undefined }) {
  const total = shifts.reduce((sum, e) => sum + assignmentMinutes(e), 0);
  return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle className="capitalize">{format(new Date(`${day}T12:00:00`), "EEEE d MMMM yyyy", { locale: it })}</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">{shifts.length ? `${shifts.length} ${shifts.length === 1 ? "turno" : "turni"} · ${formatHours(total)} h in totale` : "Nessun turno in questo giorno."}</p>
    {shifts.length > 0 && <ul className="divide-y rounded-lg border">{shifts.map(entry => {
      const status = ASSIGNMENT_STATUSES.find(s => s.value === entry.status);
      return <li key={entry.id} className="space-y-1 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="break-words font-semibold">{names.get(entry.collaborator_id) ?? "Collaboratore"}</span><span className={cn("rounded border px-2 py-0.5 text-xs font-semibold", status?.className)}>{status?.label}</span></div><p className="text-sm tabular-nums">{assignmentTime(entry)} · {formatHours(assignmentMinutes(entry))} h</p>{entry.note && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{entry.note}</p>}{entry.published_at && <p className="text-xs text-muted-foreground">Pubblicato il {new Date(entry.published_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</p>}{onEdit && <Button variant="outline" size="sm" className="mt-1" onClick={() => onEdit(entry.collaborator_id)}><Pencil />Modifica</Button>}</li>;
    })}</ul>}
    {onEdit && <div className="flex justify-end"><Button onClick={() => onEdit()}><Plus />Nuovo turno</Button></div>}
  </DialogContent></Dialog>;
}

export function AssignmentList({ assignments }: { assignments: ShiftAssignment[] }) {
  return <ul className="mt-4 divide-y">{[...assignments].sort((a, b) => a.day.localeCompare(b.day)).map(entry => <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="min-w-0"><p className="font-medium">{new Date(`${entry.day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p><p className="mt-1 text-sm">{assignmentTime(entry)}</p>{entry.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{entry.note}</p>}</div><span className={cn("rounded border px-2 py-1 text-xs font-semibold", ASSIGNMENT_STATUSES.find(s => s.value === entry.status)?.className)}>{ASSIGNMENT_STATUSES.find(s => s.value === entry.status)?.label}</span></li>)}</ul>;
}

export function AssignmentDialog({ day, personId, people, assignments, onClose, onSave, onDelete, onHistory }: { day: string; personId?: string | undefined; people: Collaborator[]; assignments: ShiftAssignment[]; onClose: () => void; onSave: (entry: Omit<ShiftAssignment, "id" | "updated_at" | "status" | "published_at">) => Promise<void>; onDelete: (personId: string, day: string) => Promise<void>; onHistory?: (personId: string, day: string) => void }) {
  const [person, setPerson] = useState(personId ?? people[0]?.id ?? "");
  const [date, setDate] = useState(day);
  const existing = assignments.find(e => e.day === date && e.collaborator_id === person);
  const [start, setStart] = useState(existing?.starts_at.slice(0, 5) ?? "");
  const [end, setEnd] = useState(existing?.ends_at.slice(0, 5) ?? "");
  const [nextDay, setNextDay] = useState(existing?.ends_next_day ?? false);
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function choose(id: string, newDate: string) {
    setPerson(id); setDate(newDate); setError("");
    const entry = assignments.find(e => e.collaborator_id === id && e.day === newDate);
    setStart(entry?.starts_at.slice(0, 5) ?? ""); setEnd(entry?.ends_at.slice(0, 5) ?? ""); setNextDay(entry?.ends_next_day ?? false); setNote(entry?.note ?? "");
  }
  async function save(remove = false) {
    const parsed = assignmentInputSchema.safeParse({ collaborator_id: person, day: date, starts_at: start, ends_at: end, ends_next_day: nextDay, note });
    if (!remove && !parsed.success) { setError(parsed.error.issues[0]?.message ?? "Controlla gli orari"); return; }
    setBusy(true); setError("");
    try { if (remove) await onDelete(person, date); else if (parsed.success) await onSave(parsed.data); onClose(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => !open && !busy && onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{existing ? "Modifica turno" : "Nuovo turno"}</DialogTitle></DialogHeader><div className="space-y-2"><Label>Collaboratore</Label><div className="flex flex-wrap gap-2">{people.map(p => <Button key={p.id} variant={person === p.id ? "secondary" : "outline"} disabled={busy} className="h-auto max-w-full whitespace-normal break-words" onClick={() => choose(p.id, date)}>{p.first_name} {p.last_name}</Button>)}</div></div><div className="space-y-2"><Label htmlFor="assignment-day">Giorno</Label><Input id="assignment-day" type="date" value={date} disabled={busy} onChange={e => choose(person, e.target.value)} /></div><p className="text-sm text-muted-foreground">{existing ? <>Stato: <span className={cn("rounded border px-2 py-0.5 text-xs font-semibold", ASSIGNMENT_STATUSES.find(s => s.value === existing.status)?.className)}>{ASSIGNMENT_STATUSES.find(s => s.value === existing.status)?.label}</span>{existing.status === "pubblicato" && " — se lo cambi diventa Modificato"}</> : "Il nuovo turno resta in Bozza finché non pubblichi."}</p><div className="grid grid-cols-2 gap-3"><div className="min-w-0 space-y-2"><Label htmlFor="assignment-start">Inizio</Label><Input id="assignment-start" type="time" value={start} disabled={busy} onChange={e => setStart(e.target.value)} /></div><div className="min-w-0 space-y-2"><Label htmlFor="assignment-end">Fine</Label><Input id="assignment-end" type="time" value={end} disabled={busy} onChange={e => setEnd(e.target.value)} /></div></div><Label className="flex items-center gap-2"><input type="checkbox" checked={nextDay} disabled={busy} onChange={e => setNextDay(e.target.checked)} />Fine il giorno successivo</Label><div className="space-y-2"><Label htmlFor="assignment-note">Note del turno</Label><Textarea id="assignment-note" maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-2">{existing && <Button variant="ghost" disabled={busy} onClick={() => save(true)}><Trash2 />Elimina turno</Button>}{onHistory && person && <Button variant="ghost" disabled={busy} onClick={() => onHistory(person, date)}><History />Cronologia</Button>}</div><Button disabled={busy || !person} onClick={() => save()}><Save />Salva turno</Button></div></DialogContent></Dialog>;
}