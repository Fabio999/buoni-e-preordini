import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShiftSummary } from "@/components/shifts/ShiftOverview";
import type { Collaborator } from "@/lib/shifts";

const person = { id: "p1", first_name: "Fabio", last_name: "Penocchio", active: true } as Collaborator;

describe("Giorni con meno di 3 persone riducibili a icona", () => {
  afterEach(() => { cleanup(); localStorage.clear(); });
  it("si riduce a un'icona con il numero di giorni, lo ricorda e si riapre", () => {
    render(<ShiftSummary days={["2026-11-10", "2026-11-11"]} people={[person]} assignments={[]} entries={[]} />);
    expect(screen.getByText(/Giorni con meno di 3 persone/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Riduci a icona/ }));
    expect(screen.queryByText(/Giorni con meno di 3 persone/)).toBeNull();
    cleanup();
    render(<ShiftSummary days={["2026-11-10", "2026-11-11"]} people={[person]} assignments={[]} entries={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Mostra giorni con meno di 3 persone (2)" }));
    expect(screen.getByText(/Giorni con meno di 3 persone/)).toBeTruthy();
  });
});
