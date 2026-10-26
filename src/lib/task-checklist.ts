export type TaskChecklistItem = { id: string; text: string; done: boolean };

/** Read historical checklists defensively without discarding usable entries. */
export function taskChecklist(value: unknown): TaskChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (typeof entry === "string") return entry.trim() ? [{ id: `legacy-${index}`, text: entry, done: false }] : [];
    if (!entry || typeof entry !== "object") return [];
    const text = entry.text ?? entry.title ?? entry.label;
    if (typeof text !== "string" || !text.trim()) return [];
    return [{ id: typeof entry.id === "string" ? entry.id : `legacy-${index}`, text, done: entry.done === true || entry.completed === true }];
  });
}

export const saveTaskChecklist = (items: TaskChecklistItem[]) =>
  items.filter(item => item.text.trim()).map(item => ({ ...item, text: item.text.trim() }));

export const toggleTaskChecklist = (items: TaskChecklistItem[], id: string, done: boolean) =>
  items.map(item => item.id === id ? { ...item, done } : item);
export const DEFAULT_TASK_CHECKLIST = ["Messaggio con carte e totale mandato al cliente", "Controllo carte a magazzino", "Rispondere con totale", "Preparare ordine", "Consegnato"];

/** Append default entries that are not already present (case-insensitive). */
export function withDefaultChecklist(items: TaskChecklistItem[]): TaskChecklistItem[] {
  const seen = new Set(items.map(item => item.text.trim().toLowerCase()));
  return [...items, ...DEFAULT_TASK_CHECKLIST.filter(text => !seen.has(text.toLowerCase())).map(text => ({ id: crypto.randomUUID(), text, done: false }))];
}
