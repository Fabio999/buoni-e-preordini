import { describe, it, expect } from "vitest";
import { gameColor, gameLegend } from "@/lib/game-colors";

describe("colori per gioco", () => {
  it("Riftbound è arancione e Cyberpunk rosa", () => {
    expect(gameColor("Riftbound")).toBe("arancione");
    expect(gameColor("cyberpunk")).toBe("rosa");
  });
  it("la legenda usa il colore più frequente del gioco", () => {
    expect(gameLegend([{ game: "Riftbound", color: "arancione" }, { game: "riftbound", color: "arancione" }, { game: "Riftbound", color: "blu" }])).toEqual([{ game: "Riftbound", color: "arancione" }]);
  });
});
