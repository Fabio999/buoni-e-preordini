import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Copy, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useTasks } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { generateTaskDraft } from "@/lib/task-ai.functions";
import { cleanDraft, readTemplates, rememberTemplates, similarTemplates, type TaskTemplate, type TaskSeed } from "@/lib/task-drafts";

export function TaskAssistant({ open, onOpenChange, onDraft }: { open: boolean; onOpenChange: (open: boolean) => void; onDraft: (draft: TaskSeed) => void }) {
  const { session } = useAuth();
  const { data: tasks = [] } = useTasks();
  const generate = useServerFn(generateTaskDraft);
  const [description, setDescription] = useState("");
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || !session) return;
    const local = readTemplates(session.user.id);
    const saved = tasks.filter(t => t.source_description).map(t => ({ source_description: t.source_description, draft: { title: t.title, description: t.description } }));
    setTemplates(rememberTemplates(session.user.id, [...local, ...saved]));
    let active = true;
    supabase.from("task_templates").select("source_description,draft").order("created_at", { ascending: false }).limit(100).then(({ data }) => {
      if (!active) return;
      const shared = (data ?? []).flatMap(row => { try { return [{ source_description: row.source_description, draft: cleanDraft(row.draft) }]; } catch { return []; } });
      setTemplates(rememberTemplates(session.user.id, [...shared.reverse(), ...local, ...saved]));
    });
    return () => { active = false; };
  }, [open, session, tasks]);
  const suggestions = similarTemplates(description, templates);
  function applyTemplate(template: TaskTemplate) {
    onOpenChange(false);
    onDraft({ ...template.draft, source_description: description.trim() || template.source_description });
  }
  async function prepare() {
    if (busy || !session) return;
    const exact = suggestions.find(s => s.exact);
    if (exact) { applyTemplate(exact.template); return; }
    setBusy(true); setError("");
    try {
      const result = await generate({ data: { description } });
      if (result.error || !result.draft) { setError(result.error ?? "Proposta non disponibile."); return; }
      const template = { source_description: description.trim(), draft: result.draft };
      setTemplates(rememberTemplates(session.user.id, [...templates, template]));
      applyTemplate(template);
    } catch { setError("Non è possibile contattare AI Gateway. La descrizione resta qui; puoi creare la task manualmente."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Descrivi una nuova attività</DialogTitle><DialogDescription>Nuova proposta: usa crediti AI Gateway. Riuso di un lavoro salvato: nessun credito AI.</DialogDescription></DialogHeader>
    <Textarea aria-label="Lavoro da organizzare" placeholder="Descrivi il lavoro da svolgere…" rows={5} maxLength={2000} disabled={busy} value={description} onChange={e => { setDescription(e.target.value); setError(""); }}/>
    {!!suggestions.length && <section className="space-y-2"><h3 className="text-sm font-semibold">{description ? "Lavori simili salvati" : "Lavori salvati"}</h3><ul className="divide-y">{suggestions.map(({ template, exact }, i) => <li className="flex items-start justify-between gap-3 py-3" key={i}><div className="min-w-0"><strong className="block break-words text-sm">{template.draft.title}</strong><p className="line-clamp-2 break-words text-xs text-muted-foreground">{template.source_description}</p>{exact && <span className="text-xs text-success">Stessa descrizione</span>}</div><Button disabled={busy} variant="outline" size="sm" onClick={() => applyTemplate(template)}><Copy className="size-4"/>Riusa</Button></li>)}</ul></section>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => { onOpenChange(false); onDraft({ title: "", description, source_description: description }); }}>Crea manualmente</Button><Button disabled={busy || description.trim().length < 8} onClick={prepare}>{busy ? <LoaderCircle className="size-4 animate-spin"/> : <Sparkles className="size-4"/>}{busy ? "Preparazione…" : suggestions.some(s => s.exact) ? "Riusa proposta" : "Genera proposta"}</Button></div>
  </DialogContent></Dialog>;
}