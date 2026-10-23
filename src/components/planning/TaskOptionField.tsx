import { useEffect, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, selectClass } from "@/components/forms/SimpleDialogs";
import { useAuth } from "@/lib/auth";
import { useTasks, useCalendarEntries, useProducts } from "@/lib/data";
import { TASK_CATEGORIES } from "@/lib/task-workflow";
import { mergeGames, readGames, gamesKey } from "@/lib/event-recurrence";
import { readCategories, rememberCategory } from "@/lib/task-options";
import { normalizeText } from "@/lib/search";

export function TaskOptionField({ kind, value, onChange, open }: {
  kind: "category" | "game"; value: string; onChange: (value: string) => void; open: boolean;
}) {
  const { session } = useAuth();
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useCalendarEntries();
  const { data: products = [] } = useProducts();
  const [saved, setSaved] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const account = session?.user.id;
  const category = kind === "category";
  useEffect(() => {
    setSaved(account ? (category ? readCategories(account) : readGames(account)) : []);
    setAdding(false); setName("");
  }, [account, category, open]);
  const options = category
    ? mergeGames([value], TASK_CATEGORIES, saved, tasks.map(task => task.category))
    : mergeGames([value], saved, tasks.map(task => task.game), events.map(event => event.game), products.map(product => product.game));
  function create() {
    const clean = name.trim();
    if (!clean || !account) return;
    const canonical = options.find(option => normalizeText(option) === normalizeText(clean)) ?? clean;
    try {
      const next = category ? rememberCategory(account, canonical) : mergeGames(readGames(account), [canonical]);
      if (!category) localStorage.setItem(gamesKey(account), JSON.stringify(next));
      setSaved(next); onChange(canonical); setAdding(false); setName("");
    } catch { toast.error("Impossibile salvare sul dispositivo: controlla lo spazio disponibile."); }
  }
  return <Field label={category ? "Categoria" : "Tipologie di gioco · sottotitolo"}>
    <div className="flex min-w-0 gap-2">
      <select className={selectClass} aria-label={category ? "Categoria task" : "Tipologie di gioco task"} value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{category ? "Scegli categoria" : "Scegli gioco"}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <Button type="button" variant="outline" size="icon" className="shrink-0" title={category ? "Nuova categoria" : "Nuovo gioco"} aria-label={category ? "Nuova categoria" : "Nuovo gioco"} onClick={() => { setAdding(true); setName(""); }}><Plus className="size-4"/></Button>
    </div>
    {adding && <div className="flex min-w-0 gap-2 pt-2">
      <Input autoFocus aria-label={category ? "Nome nuova categoria" : "Nome nuovo gioco"} placeholder={category ? "Nome categoria" : "Nome gioco"} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); create(); } if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setAdding(false); } }}/>
      <Button type="button" size="icon" className="shrink-0" disabled={!name.trim() || !account} title={category ? "Salva categoria" : "Salva gioco"} aria-label={category ? "Salva categoria" : "Salva gioco"} onClick={create}><Check className="size-4"/></Button>
      <Button type="button" variant="ghost" size="icon" className="shrink-0" title="Annulla inserimento" aria-label="Annulla inserimento" onClick={() => setAdding(false)}><X className="size-4"/></Button>
    </div>}
  </Field>;
}
