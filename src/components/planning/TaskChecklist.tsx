import { Plus, Trash2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toggleTaskChecklist, type TaskChecklistItem } from "@/lib/task-checklist";

export function TaskChecklist({ items, onChange, editing = false, disabled = false }: {
  items: TaskChecklistItem[];
  onChange: (items: TaskChecklistItem[]) => void;
  editing?: boolean;
  disabled?: boolean;
}) {
  if (!editing && !items.length) return null;
  return <section aria-label="Checklist task" className="min-w-0 space-y-3 border-y py-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="size-4 text-info"/>Checklist <span className="font-normal text-muted-foreground">{items.filter(item => item.done).length}/{items.length}</span></h3>
      {editing && <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { id: crypto.randomUUID(), text: "", done: false }])}><Plus className="size-4"/>Aggiungi voce</Button>}
    </div>
    <ul className="space-y-2">{items.map((item, index) => <li key={item.id} className="flex min-w-0 items-start gap-2">
      <Checkbox className="mt-2.5" aria-label={`Completa voce ${index + 1}`} checked={item.done} disabled={disabled} onCheckedChange={done => onChange(toggleTaskChecklist(items, item.id, done === true))}/>
      {editing ? <Input className="min-w-0 flex-1" aria-label={`Voce checklist ${index + 1}`} value={item.text} placeholder="Voce da fare" onChange={event => onChange(items.map(entry => entry.id === item.id ? {...entry, text: event.target.value} : entry))}/> : <label className={cn("min-w-0 flex-1 cursor-pointer whitespace-pre-wrap py-2 text-sm [overflow-wrap:anywhere]", item.done && "text-muted-foreground line-through")} onClick={() => { if (!disabled) onChange(toggleTaskChecklist(items, item.id, !item.done)); }}>{item.text}</label>}
      {editing && <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`Elimina voce checklist ${index + 1}`} title="Elimina voce" onClick={() => onChange(items.filter(entry => entry.id !== item.id))}><Trash2 className="size-4"/></Button>}
    </li>)}</ul>
  </section>;
}