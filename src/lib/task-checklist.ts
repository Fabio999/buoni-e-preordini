export type TaskChecklistItem = { id: string; text: string; done: boolean; doneBy?: string };

/** Read historical checklists defensively without discarding usable entries. */
export function taskChecklist(value: unknown): TaskChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (typeof entry === "string") return entry.trim() ? [{ id: `legacy-${index}`, text: entry, done: false }] : [];
    if (!entry || typeof entry !== "object") return [];
    const text = entry.text ?? entry.title ?? entry.label;
    if (typeof text !== "string" || !text.trim()) return [];
    return [{ id: typeof entry.id === "string" ? entry.id : `legacy-${index}`, text, done: entry.done === true || entry.completed === true, ...(typeof entry.doneBy === "string" && entry.doneBy.trim() ? { doneBy: entry.doneBy } : {}) }];
  });
}

export const saveTaskChecklist = (items: TaskChecklistItem[]) =>
  items.filter(item => item.text.trim()).map(item => ({ ...item, text: item.text.trim() }));

/** Checking an item stamps the current operator unless a name was already written; unchecking clears it. */
export const toggleTaskChecklist = (items: TaskChecklistItem[], id: string, done: boolean, operator = "") =>
  items.map(item => {
    if (item.id !== id) return item;
    const { doneBy, ...rest } = item;
    return done ? { ...rest, done, ...((doneBy || operator).trim() ? { doneBy: (doneBy || operator).trim() } : {}) } : { ...rest, done };
  });

export const setChecklistDoneBy = (items: TaskChecklistItem[], id: string, name: string) =>
  items.map(item => item.id === id ? { ...item, doneBy: name } : item);

type LearnSource = { id: string; category: string; checklist: unknown; created_at: string };
/** Learn the checklist of a task type from the most recent task of the same category. */
export function learnedChecklist(tasks: LearnSource[], category: string, excludeId?: string): string[] {
  const key = category.trim().toLowerCase();
  if (!key) return [];
  const source = [...tasks].filter(t => t.id !== excludeId && t.category.trim().toLowerCase() === key && taskChecklist(t.checklist).length)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return source ? taskChecklist(source.checklist).map(item => item.text.trim()) : [];
}
export const DEFAULT_TASK_CHECKLIST = ["Messaggio con carte e totale mandato al cliente", "Controllo carte a magazzino", "Rispondere con totale", "Preparare ordine", "Consegnato"];

/** Append default entries that are not already present (case-insensitive). */
export function withDefaultChecklist(items: TaskChecklistItem[], defaults: string[] = DEFAULT_TASK_CHECKLIST): TaskChecklistItem[] {
  const seen = new Set(items.map(item => item.text.trim().toLowerCase()));
  return [...items, ...(defaults.length ? defaults : DEFAULT_TASK_CHECKLIST).filter(text => !seen.has(text.toLowerCase())).map(text => ({ id: crypto.randomUUID(), text, done: false }))];
}
