import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TaskPeopleField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const names = value.split(/\n|;/);
  return <section className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Responsabili · nome e cognome</h3><Button type="button" variant="outline" size="sm" onClick={() => onChange([...names, ""].join("\n"))}><Plus className="size-4"/>Aggiungi persona</Button></div>{names.map((name, index) => <div key={index} className="flex items-center gap-2"><Input list="planning-people" aria-label={`Responsabile task ${index + 1}`} value={name} onChange={e => onChange(names.map((item, i) => i === index ? e.target.value : item).join("\n"))}/><Button type="button" variant="ghost" size="icon" title="Rimuovi responsabile" aria-label={`Rimuovi responsabile ${index + 1}`} onClick={() => onChange(names.filter((_, i) => i !== index).join("\n"))}><Trash2 className="size-4"/></Button></div>)}</section>;
}