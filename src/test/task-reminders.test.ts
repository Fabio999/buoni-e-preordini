import { describe, it, expect } from "vitest";
import { taskReminders, assignedDeadlineTasks, deadlineReminders } from "@/lib/task-reminders";
import type { Task } from "@/lib/planning";

const now = new Date("2026-10-23T20:00:00Z");
const task: Task = { id: "task-1", title: "Preparare ordine", category: "Ritiro", game: "Pokémon", location: "Banco", workflow_stages: ["Ritiro", "Valutazione", "Totale"], workflow_position: 0, workflow_workers: [], description: "", checklist: [], source_description: "", responsible: "Fabio Penocchio", due_at: "2026-10-23T20:30:00Z", starts_at: null, archived: false, status: "da_fare", priority: "normale", mandatory: true, claimed_at: null, claimed_by: "", started_at: null, started_by: "", completed_at: null, completed_by: "", created_at: now.toISOString(), updated_at: now.toISOString() };
describe("Promemoria responsabili", () => {
  it("limita i dati del link alla persona assegnata senza esporre altri responsabili o dettagli", () => {
    const result = assignedDeadlineTasks([{ ...task, responsible: "Fabio Penocchio;Giulia Bianchi" }, { ...task, id: "private", responsible: "Luca Rossi" }], "FABIO PENOCCHIO");
    expect(result).toEqual([{ id: "task-1", title: "Preparare ordine", due_at: "2026-10-23T20:30:00Z", status: "da_fare", archived: false }]);
    expect(assignedDeadlineTasks([task], "Fabio")).toEqual([]);
  });
  it("avvisa nei link anche quando una scadenza futura entra nell’ultima ora senza nuove letture", () => {
    const rows = assignedDeadlineTasks([{ ...task, due_at: "2026-10-23T22:00:00Z" }], task.responsible);
    expect(deadlineReminders(rows, now)).toEqual([]);
    expect(deadlineReminders(rows, new Date("2026-10-23T21:00:00Z"))[0]?.late).toBe(false);
    expect(deadlineReminders(rows, new Date("2026-10-23T22:01:00Z"))[0]?.late).toBe(true);
  });
  it("avvisa ciascuna persona assegnata alla stessa task", () => {
    const shared = { ...task, responsible: "Fabio Penocchio\nGiulia Bianchi" };
    expect(taskReminders([shared], "Fabio Penocchio", now)).toHaveLength(1);
    expect(taskReminders([shared], "Giulia Bianchi", now)).toHaveLength(1);
    expect(taskReminders([shared], "Luca Rossi", now)).toHaveLength(0);
  });
  it("avvisa il responsabile entro un'ora, non prima", () => {
    expect(taskReminders([task], "Fabio Penocchio", now)[0]?.late).toBe(false);
    expect(taskReminders([{ ...task, due_at: "2026-10-23T21:01:00Z" }], "Fabio Penocchio", now)).toEqual([]);
  });
  it("non avvisa altre persone né attività senza responsabile", () => {
    expect(taskReminders([task], "Giulia Bianchi", now)).toEqual([]);
    expect(taskReminders([{ ...task, responsible: "" }], "", now)).toEqual([]);
  });
  it("avvisa in ritardo con una chiave distinta e senza completare la task", () => {
    const soon = taskReminders([task], task.responsible, now)[0];
    const late = taskReminders([task], task.responsible, new Date("2026-10-23T20:31:00Z"))[0];
    expect(late?.late).toBe(true);
    expect(late?.key).not.toBe(soon?.key);
    expect(task.status).toBe("da_fare");
  });
  it("esclude completate e archiviate", () => {
    expect(taskReminders([{ ...task, status: "completata" }, { ...task, archived: true }], task.responsible, now)).toEqual([]);
  });
});