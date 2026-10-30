import { useState } from "react";
import { addMonths, format } from "date-fns";
import { it } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight, MessageSquare, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SHIFT_STATUSES, monthDays, type ShiftEntry, type ShiftStatus } from "@/lib/shifts";
import { cn } from "@/lib/utils";

export function ShiftLegend() {
  return <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">{SHIFT_STATUSES.map(s => <span key={s.value} className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", s.dot)} />{s.label}</span>)}<span className="flex items-center gap-2 text-muted-foreground"><span className="size-2.5 rounded-full border bg-muted" />Non indicato</span></div>;
}
export function MonthControls({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const date = new Date(`${month}-01T12:00:00`);
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold capitalize">{format(date, "MMMM yyyy", { locale: it })}</h2><div className="flex items-center gap-1"><Button variant="outline" size="icon" aria-label="Mese precedente" onClick={() => onChange(format(addMonths(date, -1), "yyyy-MM"))}><ChevronLeft /></Button><Button variant="outline" onClick={() => onChange(formatInTimeZone(new Date(), "Europe/Rome", "yyyy-MM"))}>Oggi</Button><Button variant="outline" size="icon" aria-label="Mese successivo" onClick={() => onChange(format(addMonths(date, 1), "yyyy-MM"))}><ChevronRight /></Button></div></div>;
}
export function ShiftCalendar({ month, entries, onEdit }: { month: string; entries: ShiftEntry[]; onEdit: (day: string) => void }) {
  const today = formatInTimeZone(new Date(), "Europe/Rome", "yyyy-MM-dd");
  const lookup = new Map(entries.map(e => [e.day, e]));
  return <div className="overflow-hidden rounded-lg border bg-card"><div className="grid grid-cols-7 border-b bg-muted/60">{["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => <div key={d} className="py-3 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}</div><div className="grid grid-cols-7">{monthDays(month).map(day => {
    const entry = lookup.get(day);
    const state = SHIFT_STATUSES.find(s => s.value === entry?.status);
    return <Button key={day} variant="ghost" aria-label={`Disponibilità ${day}${state ? `: ${state.label}` : ""}`} onClick={() => onEdit(day)} className={cn("relative flex h-20 min-w-0 flex-col items-start justify-between gap-1 whitespace-normal rounded-none border-b border-r p-2 text-left sm:h-28 sm:p-3", day.startsWith(month) ? "" : "opacity-45", state?.className, day === today && "ring-1 ring-inset ring-primary")}><span className={cn("text-xs font-semibold", day === today && "text-primary")}>{Number(day.slice(-2))}</span><span className="flex w-full min-w-0 items-center justify-between gap-1">{state && <><span className={cn("size-2.5 shrink-0 rounded-full", state.dot)} /><span className="hidden min-w-0 break-words text-[11px] leading-tight sm:block">{state.label}</span></>}{entry?.note && <MessageSquare className="ml-auto size-3 shrink-0" />}</span></Button>;
  })}</div></div>;
}
export function ShiftEditDialog({ day, entry, name, onClose, onSave }: { day: string; entry?: ShiftEntry; name: string; onClose: () => void; onSave: (data: { day: string; status: ShiftStatus | null; note: string }) => Promise<void> }) {
  const [status, setStatus] = useState<ShiftStatus | null>((entry?.status as ShiftStatus) ?? null);
  const [note, setNote] = useState(entry?.note ?? "");
  const [busy, setBusy] = useState(false);
  async function save(clear = false) {
    setBusy(true);
    try { await onSave({ day, status: clear ? null : status, note: clear ? "" : note }); onClose(); }
    catch { /* Parent shows the error; preserve the draft. */ }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={o => !o && !busy && onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="break-words">{format(new Date(`${day}T12:00:00`), "EEEE d MMMM", { locale: it })}</DialogTitle></DialogHeader><p className="break-words text-sm text-muted-foreground">{name}</p><div className="grid gap-2 sm:grid-cols-3">{SHIFT_STATUSES.map(s => <Button key={s.value} variant="outline" aria-pressed={status === s.value} disabled={busy} onClick={() => setStatus(s.value)} className={cn("h-11", s.className, status === s.value && "ring-2 ring-current")}><span className={cn("size-2 shrink-0 rounded-full", s.dot)} />{s.label}</Button>)}</div><div className="space-y-2"><Label htmlFor="shift-note">Note</Label><Textarea id="shift-note" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={4} placeholder="Disponibile dopo le 18…" disabled={busy} /></div><div className="flex flex-wrap justify-between gap-2">{entry ? <Button variant="ghost" disabled={busy} onClick={() => save(true)}><Trash2 />Rimuovi disponibilità</Button> : <span />}<Button disabled={busy || !status} onClick={() => save()}><Save />{busy ? "Salvataggio…" : "Salva"}</Button></div></DialogContent></Dialog>;
}