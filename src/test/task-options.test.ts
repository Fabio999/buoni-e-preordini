import { beforeEach, describe, expect, it } from "vitest";
import { categoriesKey, readCategories, rememberCategory } from "@/lib/task-options";
import { readGames, rememberGame } from "@/lib/event-recurrence";
describe("scelte personalizzate delle task", () => {
  beforeEach(() => localStorage.clear());
  it("conserva una categoria manuale per le scelte successive", () => {
    rememberCategory("negozio", " Preparazione tornei ");
    expect(readCategories("negozio")).toEqual(["Preparazione tornei"]);
    expect(readCategories("altro-account")).toEqual([]);
  });
  it("non duplica categorie con maiuscole diverse e ignora nomi vuoti", () => {
    rememberCategory("negozio", "Ritiro");
    rememberCategory("negozio", "ritiro");
    rememberCategory("negozio", " ");
    expect(readCategories("negozio")).toEqual(["Ritiro"]);
  });
  it("conserva anche i giochi manuali nella memoria condivisa con gli eventi", () => {
    rememberGame("negozio", "Riftbound");
    expect(readGames("negozio")).toEqual(["Riftbound"]);
    expect(readGames("altro-account")).toEqual([]);
  });
  it("gestisce memoria danneggiata senza bloccare le scelte", () => {
    localStorage.setItem(categoriesKey("negozio"), "not-json");
    expect(readCategories("negozio")).toEqual([]);
  });
});
