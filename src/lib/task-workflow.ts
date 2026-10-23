export const TASK_CATEGORIES = ["Ritiro", "Caricare", "Riordinare", "Controllo mail e risposta"];
export const DEFAULT_TASK_STAGES = ["Ritiro", "Valutazione", "Totale"];

export function taskStages(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !!item.trim()).map(item => item.trim()) : [];
}

export function workflowAt(stages: string[], position: number) {
  const workflow_position = Math.max(0, Math.min(stages.length, Math.trunc(position)));
  return { workflow_position, status: workflow_position === 0 ? "da_fare" : workflow_position === stages.length ? "completata" : "in_corso" };
}

export function positionForStatus(stages: string[], position: number, status: string) {
  if (status === "completata") return stages.length;
  if (status === "da_fare") return 0;
  return Math.min(Math.max(0, position), Math.max(0, stages.length - 1));
}