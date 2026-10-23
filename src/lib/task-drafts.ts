import { z } from "zod";
import { normalizeText } from "./search";

export const taskDraftSchema = z.object({ title: z.string(), description: z.string(), checklist: z.array(z.string()) }).strict();
export type TaskDraft = z.infer<typeof taskDraftSchema>;
export type ChecklistStep = { text: string; done: boolean };
export type TaskSeed = TaskDraft & { source_description: string };
export type TaskTemplate = { source_description: string; draft: TaskDraft };
export const descriptionKey = (text: string) => normalizeText(text).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
export function checklistOf(value: unknown): ChecklistStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => item && typeof item === "object" && typeof item.text === "string" ? [{ text: item.text, done: item.done === true }] : []);
}
export function cleanDraft(value: unknown): TaskDraft {
  const draft = taskDraftSchema.parse(value);
  const title = draft.title.trim().slice(0, 120);
  const checklist = draft.checklist.map(s => s.trim().slice(0, 240)).filter(Boolean).slice(0, 12);
  if (!title || !checklist.length) throw new Error("La proposta è incompleta: puoi creare la task manualmente.");
  return { title, description: draft.description.trim().slice(0, 1600), checklist };
}
export function similarTemplates(text: string, templates: TaskTemplate[]) {
  const key = descriptionKey(text);
  if (!key) return templates.slice(0, 3).map(template => ({ template, exact: false, score: 0 }));
  const words = new Set(key.split(" ").filter(w => w.length > 2));
  return templates.map(template => {
    const other = descriptionKey(template.source_description);
    const tokens = new Set(other.split(" ").filter(w => w.length > 2));
    const common = [...words].filter(w => tokens.has(w)).length;
    const score = key === other ? 1 : common / Math.max(1, new Set([...words, ...tokens]).size);
    return { template, exact: key === other, score };
  }).filter(x => x.exact || x.score >= 0.25).sort((a, b) => b.score - a.score).slice(0, 3);
}
export function readTemplates(account: string): TaskTemplate[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(`mf-task-templates:${account}`) ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows.flatMap(row => { try { return typeof row.source_description === "string" ? [{ source_description: row.source_description, draft: cleanDraft(row.draft) }] : []; } catch { return []; } });
  } catch { return []; }
}
export function rememberTemplates(account: string, templates: TaskTemplate[]) {
  const unique = new Map<string, TaskTemplate>();
  for (const template of templates) unique.set(descriptionKey(template.source_description), template);
  const result = [...unique.values()].slice(-100);
  try { localStorage.setItem(`mf-task-templates:${account}`, JSON.stringify(result)); } catch { /* Server copy still remains available. */ }
  return result;
}