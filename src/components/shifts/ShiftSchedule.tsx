import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ASSIGNMENT_STATUSES, assignmentInputSchema, assignmentTime, monthDays, type Collaborator, type ShiftAssignment } from "@/lib/shifts";
import { cn } from "@/lib/utils";

export function ShiftSchedule({ month, assignments, people, onEdit }: { month: string; assignments: ShiftAssignment[]; people: Collaborator[]; onEdit?: (day: string, collaboratorId?: string) => void }) {
  const today = formatInTimeZone(new Date(), "Europe/Rome", "yyyy-MM-dd");
  const names = new Map(people.map(p => [p.id, `${p.first_name} ${p.last_name}`]));
  return <div className="overflow-x-auto rounded-lg border bg-card"><div className="min-w-[560px]"><div className="grid grid-cols-7 border-b bg-muted/60">{["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(day => <div key={day} className="py-3 text-center text-xs font-semibold text-muted-foreground">{day}</div>)}</div><div className="grid grid-cols-7">{monthDays(month).map(day => <div key={day} className={cn("min-h-28 min-w-0 border-b border-r p-2", !day.startsWith(month) && "opacity-45", day === today && "bg-primary/5 ring-1 ring-inset ring-primary")}>
    {onEdit ? <Button variant="ghost" size="sm" className="mb-2 h-7 px-2" aria-label={`Aggiungi turno ${day}`} onClick={() => onEdit(day)}>{Number(day.slice(-2))}</Button> : <p className="mb-2 text-xs font-semibold">{Number(day.slice(-2))}</p>}
    <div className="space-y-1">{assignments.filter(e => e.day === day).map(entry => {
      const status = ASSIGNMENT_STATUSES.find(s => s.value === entry.status);
      const content = <><span className="block break-words font-semibold">{names.get(entry.collaborator_id)}</span><span className="block">{entry.starts_at.slice(0, 5)}–{entry.ends_at.slice(0, 5)}{entry.ends_next_day && " +1"}</span><span className="block">{status?.label}</span></>;
      return onEdit ? <Button key={entry.id} variant="outline" className={cn("h-auto w-full min-w-0 whitespace-normal p-1.5 text-left text-[10px] leading-tight", status?.className)} onClick={() => onEdit(day, entry.collaborator_id)}><span className="w-full min-w-0">{content}</span></Button> : <div key={entry.id} className={cn("rounded border p-1.5 text-[10px] leading-tight", status?.className)}>{content}</div>;
    })}</div>
  </div>)}</div></div></div>;
}

export function AssignmentList({ assignments }: { assignments: ShiftAssignment[] }) {
  return <ul className="mt-4 divide-y">{[...assignments].sort((a, b) => a.day.localeCompare(b.day)).map(entry => <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="min-w-0"><p className="font-medium">{new Date(`${entry.day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p><p className="mt-1 text-sm">{assignmentTime(entry)}</p>{entry.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{entry.note}</p>}</div><span className={cn("rounded border px-2 py-1 text-xs font-semibold", ASSIGNMENT_STATUSES.find(s => s.value === entry.status)?.className)}>{ASSIGNMENT_STATUSES.find(s => s.value === entry.status)?.label}</span></li>)}</ul>;
}

export function AssignmentDialog({ day, personId, people, assignments, onClose, onSave, onDelete }: { day: string; personId?: string; people: Collaborator[]; assignments: ShiftAssignment[]; onClose: () => void; onSave: (entry: Omit<ShiftAssignment, "id" | "updated_at">) => Promise<void>; onDelete: (personId: string, day: string) => Promise<void> }) {
  const [person, setPerson] = useState(personId ?? people[0]?.id ?? "");
  const [date, setDate] = useState(day);
  const existing = assignments.find(e => e.day === date && e.collaborator_id === person);
  const [status, setStatus] = useState<"accettato" | "rifiutato">(existing?.status ?? "accettato");
  const [start, setStart] = useState(existing?.starts_at.slice(0, 5) ?? "");
  const [end, setEnd] = useState(existing?.ends_at.slice(0, 5) ?? "");
  const [nextDay, setNextDay] = useState(existing?.ends_next_day ?? false);
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function choose(id: string, newDate: string) {
    setPerson(id); setDate(newDate); setError("");
    const entry = assignments.find(e => e.collaborator_id === id && e.day === newDate);
    setStatus(entry?.status ?? "accettato"); setStart(entry?.starts_at.slice(0, 5) ?? ""); setEnd(entry?.ends_at.slice(0, 5) ?? ""); setNextDay(entry?.ends_next_day ?? false); setNote(entry?.note ?? "");
  }
  async function save(remove = false) {
    const parsed = assignmentInputSchema.safeParse({ collaborator_id: person, day: date, status, starts_at: start, ends_at: end, ends_next_day: nextDay, note });
    if (!remove && !parsed.success) { setError(parsed.error.issues[0]?.message ?? "Controlla gli orari"); return; }
    setBusy(true); setError("");
    try { if (remove) await onDelete(person, date); else if (parsed.success) await onSave(parsed.data); onClose(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => !open && !busy && onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{existing ? "Modifica turno" : "Nuovo turno"}</DialogTitle></DialogHeader><div className="space-y-2"><Label>Collaboratore</Label><div className="flex flex-wrap gap-2">{people.map(p => <Button key={p.id} variant={person === p.id ? "secondary" : "outline"} disabled={busy} className="h-auto max-w-full whitespace-normal break-words" onClick={() => choose(p.id, date)}>{p.first_name} {p.last_name}</Button>)}</div></div><div className="space-y-2"><Label htmlFor="assignment-day">Giorno</Label><Input id="assignment-day" type="date" value={date} disabled={busy} onChange={e => choose(person, e.target.value)} /></div><div className="flex flex-wrap gap-2">{ASSIGNMENT_STATUSES.map(s => <Button key={s.value} variant="outline" aria-pressed={status === s.value} className={cn(s.className, status === s.value && "ring-2 ring-current")} disabled={busy} onClick={() => setStatus(s.value)}>{s.label}</Button>)}</div><div className="grid grid-cols-2 gap-3"><div className="min-w-0 space-y-2"><Label htmlFor="assignment-start">Inizio</Label><Input id="assignment-start" type="time" value={start} disabled={busy} onChange={e => setStart(e.target.value)} /></div><div className="min-w-0 space-y-2"><Label htmlFor="assignment-end">Fine</Label><Input id="assignment-end" type="time" value={end} disabled={busy} onChange={e => setEnd(e.target.value)} /></div></div><Label className="flex items-center gap-2"><input type="checkbox" checked={nextDay} disabled={busy} onChange={e => setNextDay(e.target.checked)} />Fine il giorno successivo</Label><div className="space-y-2"><Label htmlFor="assignment-note">Note del turno</Label><Textarea id="assignment-note" maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex flex-wrap justify-between gap-2">{existing ? <Button variant="ghost" disabled={busy} onClick={() => save(true)}><Trash2 />Elimina turno</Button> : <span />}<Button disabled={busy || !person} onClick={() => save()}><Save />Salva turno</Button></div></DialogContent></Dialog>;
}