import { describe, expect, it } from "vitest";
import { taskChecklist, saveTaskChecklist, toggleTaskChecklist } from "@/lib/task-checklist";

describe("Checklist manuale per task", () => {
  const items = [{ id: "ritiro", text: " Ritirare carte ", done: false }, { id: "totale", text: "Calcolare totale", done: false }];
  it("salva voci manuali modificabili e scarta solo quelle vuote", () => {
    expect(saveTaskChecklist([...items, { id: "vuota", text: " ", done: false }])).toEqual([{...items[0], text: "Ritirare carte"}, items[1]]);
  });
  it("spunta e riapre solo la voce scelta mantenendo le altre", () => {
    const done = toggleTaskChecklist(items, "ritiro", true);
    expect(done).toEqual([{...items[0], done: true}, items[1]]);
    expect(toggleTaskChecklist(done, "ritiro", false)).toEqual(items);
  });
  it("rilegge le voci salvate e conserva quelle storiche compatibili", () => {
    expect(taskChecklist(JSON.parse(JSON.stringify(items)))).toEqual(items);
    expect(taskChecklist(["Ritiro", {title: "Totale", completed: true}, null])).toEqual([{id:"legacy-0",text:"Ritiro",done:false},{id:"legacy-1",text:"Totale",done:true}]);
    expect(taskChecklist({})).toEqual([]);
  });
});
import { withDefaultChecklist as wdc } from "@/lib/task-checklist";
describe("checklist predefinita", () => {
  it("aggiunge le 5 voci senza duplicare quelle presenti", () => {
    const out = wdc([{ id: "a", text: "Preparare ordine", done: true }]);
    expect(out).toHaveLength(5);
    expect(out[0]?.done).toBe(true);
  });
});

import { learnedChecklist, toggleTaskChecklist as toggle2 } from "@/lib/task-checklist";
describe("checklist per categoria e svolta da", () => {
  const tasks = [
    { id: "1", category: "Caricare carte", checklist: [{ id: "x", text: "Vecchia", done: false }], created_at: "2026-01-01" },
    { id: "2", category: "caricare carte", checklist: [{ id: "y", text: "Scansionare", done: true }], created_at: "2026-02-01" },
    { id: "3", category: "Ritiro", checklist: [{ id: "z", text: "Ritirare", done: false }], created_at: "2026-03-01" },
  ];
  it("impara dall'ultima task della stessa categoria", () => {
    expect(learnedChecklist(tasks, "Caricare Carte")).toEqual(["Scansionare"]);
    expect(learnedChecklist(tasks, "Altro")).toEqual([]);
  });
  it("segna l'operatore quando la voce viene completata", () => {
    const out = toggle2([{ id: "a", text: "t", done: false }], "a", true, "Mario Rossi");
    expect(out[0]?.doneBy).toBe("Mario Rossi");
    expect(toggle2(out, "a", false)[0]?.doneBy).toBeUndefined();
  });
});
