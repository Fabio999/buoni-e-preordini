import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskDeadlineAlerts } from "@/components/planning/TaskDeadlineAlerts";

const late = { id: "t1", title: "Chiudere cassa", due_at: new Date(Date.now() - 3600_000).toISOString(), status: "da_fare", archived: false } as const;

describe("Notifiche task riducibili a icona", () => {
  afterEach(() => { cleanup(); localStorage.clear(); });
  it("si riduce a icona con il conteggio, lo ricorda e si riapre", () => {
    render(<TaskDeadlineAlerts tasks={[late]} scope="p1" />);
    expect(screen.getByText("Chiudere cassa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Riduci a icona/ }));
    expect(screen.queryByText("Chiudere cassa")).toBeNull();
    expect(screen.getByRole("button", { name: "Mostra notifiche task (1)" })).toBeTruthy();
    cleanup();
    render(<TaskDeadlineAlerts tasks={[late]} scope="p1" />);
    expect(screen.queryByText("Chiudere cassa")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostra notifiche task (1)" }));
    expect(screen.getByText("Chiudere cassa")).toBeTruthy();
  });
});
