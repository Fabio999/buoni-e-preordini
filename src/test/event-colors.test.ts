import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVENT_COLORS } from "../lib/planning";

describe("Colori salvabili", () => {
  const migration = readFileSync("drizzle/migrations/0017_calendar_all_event_colors.sql", "utf8");
  const allowed = [...migration.matchAll(/'([^']+)'/g)].map(match => match[1]);
  it.each(EVENT_COLORS)("il salvataggio ammette $value", ({value}) => {
    expect(allowed).toContain(value);
  });
});