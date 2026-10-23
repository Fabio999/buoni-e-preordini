import { describe, expect, it } from "vitest";
import { TASK_CATEGORIES, DEFAULT_TASK_STAGES, taskStages, workflowAt, positionForStatus } from "@/lib/task-workflow";

describe("tipologie e avanzamento task", () => {
  it("offre le quattro categorie richieste", () => {
    expect(TASK_CATEGORIES).toEqual(["Ritiro", "Caricare", "Riordinare", "Controllo mail e risposta"]);
  });
  it("mantiene le fasi ordinate ritiro, valutazione, totale", () => {
    expect(taskStages(DEFAULT_TASK_STAGES)).toEqual(["Ritiro", "Valutazione", "Totale"]);
    expect(taskStages([" Ritiro ", null, "", "Valutazione", "Totale"])).toEqual(DEFAULT_TASK_STAGES);
  });
  it("suddivide l'avanzamento tra aperta, work in progress e completata", () => {
    expect(workflowAt(DEFAULT_TASK_STAGES, 0)).toEqual({workflow_position: 0, status: "da_fare"});
    expect(workflowAt(DEFAULT_TASK_STAGES, 1)).toEqual({workflow_position: 1, status: "in_corso"});
    expect(workflowAt(DEFAULT_TASK_STAGES, 3)).toEqual({workflow_position: 3, status: "completata"});
  });
  it("riaprire o completare dal menu mantiene coerente la linea", () => {
    expect(positionForStatus(DEFAULT_TASK_STAGES, 3, "da_fare")).toBe(0);
    expect(positionForStatus(DEFAULT_TASK_STAGES, 0, "completata")).toBe(3);
    expect(positionForStatus(DEFAULT_TASK_STAGES, 3, "in_corso")).toBe(2);
  });
});