import { describe, expect, it } from "vitest";
import { taskPeople, formatTaskPeople } from "@/lib/task-people";

describe("Responsabili task", () => {
  it("conserva più persone e resta compatibile con un solo responsabile", () => {
    expect(taskPeople("Fabio Penocchio\nGiulia Bianchi")).toEqual(["Fabio Penocchio", "Giulia Bianchi"]);
    expect(taskPeople("Fabio Penocchio")).toEqual(["Fabio Penocchio"]);
  });
  it("rimuove righe vuote e persone duplicate al salvataggio", () => {
    expect(formatTaskPeople(" Fabio Penocchio\n\nGiulia Bianchi; fabio penocchio ")).toBe("Fabio Penocchio\nGiulia Bianchi");
  });
});