import { normalizeText } from "@/lib/search";
import { taskPeople } from "@/lib/task-people";
import { wallTime, type Task } from "@/lib/planning";

export type Reminder = { task: Task; late: boolean; key: string };
export function taskReminders(tasks: Task[], operator: string, now = new Date()): Reminder[] {
  const name = normalizeText(operator.trim());
  if (!name) return [];
  return tasks.flatMap(task => {
    if (task.archived || task.status === "completata" || !task.due_at || !taskPeople(task.responsible).some(person => normalizeText(person) === name)) return [];
    const time = new Date(task.due_at).getTime() - now.getTime();
    if (!Number.isFinite(time) || time > 60 * 60_000) return [];
    const late = time < 0;
    return [{ task, late, key: `${task.id}:${task.due_at}:${late ? `late:${wallTime(now.toISOString()).slice(0, 10)}` : "soon"}` }];
  }).sort((a, b) => new Date(a.task.due_at ?? "").getTime() - new Date(b.task.due_at ?? "").getTime());
}