import { describe, expect, it } from "vitest";
import { descriptionKey, similarTemplates, checklistOf } from "../lib/task-drafts";
const template = { source_description: "Preparare tavoli e mazzi per torneo Pokémon", draft: { title: "Preparazione torneo", description: "Organizzare i tavoli", checklist: ["Preparare i tavoli", "Controllare i mazzi"] } };
describe("Riuso delle attività", () => {
  it("riconosce lo stesso lavoro senza nuove chiamate AI anche con accenti e punteggiatura diversi", () => {
    expect(descriptionKey(" PREPARARE tavoli e mazzi per torneo Pokemon! ")).toBe(descriptionKey(template.source_description));
    expect(similarTemplates("Preparare tavoli e mazzi per torneo Pokemon!", [template])[0]?.exact).toBe(true);
  });
  it("propone descrizioni simili senza riusarle automaticamente", () => {
    const result = similarTemplates("Preparare tavoli per torneo Magic", [template]);
    expect(result).toHaveLength(1);
    expect(result[0]?.exact).toBe(false);
  });
  it("non propone lavori diversi", () => { expect(similarTemplates("Contare incassi della giornata", [template])).toHaveLength(0); });
  it("mantiene testi e completamento della checklist salvata", () => {
    expect(checklistOf([{ text: "Preparare i tavoli", done: true }, { text: "Controllare i mazzi", done: false }])).toEqual([{ text: "Preparare i tavoli", done: true }, { text: "Controllare i mazzi", done: false }]);
  });
});