import { normalizeText } from "@/lib/search";
import { taskPeople } from "@/lib/task-people";
import { wallTime, type Task } from "@/lib/planning";

export type DeadlineTask = Pick<Task, "id" | "title" | "due_at" | "status" | "archived" | "responsible">;
export type PersonalDeadlineTask = Omit<DeadlineTask, "responsible">;
export function assignedDeadlineTasks(tasks: DeadlineTask[], operator: string): PersonalDeadlineTask[] {
  const name = normalizeText(operator);
  if (!name) return [];
  return tasks.filter(task => !task.archived && task.status !== "completata" && task.due_at && taskPeople(task.responsible).some(person => normalizeText(person) === name))
    .map(({ id, title, due_at, status, archived }) => ({ id, title, due_at, status, archived }));
}
export type Reminder<T = Task> = { task: T; late: boolean; key: string };
export function deadlineReminders<T extends PersonalDeadlineTask>(tasks: T[], now = new Date()): Reminder<T>[] {
  return tasks.flatMap(task => {
    if (task.archived || task.status === "completata" || !task.due_at) return [];
    const time = new Date(task.due_at).getTime() - now.getTime();
    if (!Number.isFinite(time) || time > 60 * 60_000) return [];
    const late = time < 0;
    return [{ task, late, key: `${task.id}:${task.due_at}:${late ? `late:${wallTime(now.toISOString()).slice(0, 10)}` : "soon"}` }];
  }).sort((a, b) => new Date(a.task.due_at ?? "").getTime() - new Date(b.task.due_at ?? "").getTime());
}
export function taskReminders(tasks: Task[], operator: string, now = new Date()): Reminder[] {
  const name = normalizeText(operator.trim());
  if (!name) return [];
  return deadlineReminders(tasks.filter(task => taskPeople(task.responsible).some(person => normalizeText(person) === name)), now);
}