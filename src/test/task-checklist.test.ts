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