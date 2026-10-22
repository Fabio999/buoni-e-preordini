import { describe, expect, it } from "vitest";
import { saleSplit } from "@/lib/data";

describe("vendita con buono", () => {
  it("prodotto da 15 € con buono da 8 €: paga 7 € e il buono va a 0", () => {
    expect(saleSplit(15, 8, 8)).toEqual({ used: 8, toPay: 7, remaining: 0 });
  });
  it("il buono copre al massimo il totale della vendita", () => {
    expect(saleSplit(15, 20, 20)).toEqual({ used: 15, toPay: 0, remaining: 5 });
  });
  it("senza buono la vendita resta normale", () => {
    expect(saleSplit(15, 0, 0)).toEqual({ used: 0, toPay: 15, remaining: 0 });
  });
  it("il buono non va mai in negativo", () => {
    expect(saleSplit(15, 8, 12)).toEqual({ used: 8, toPay: 7, remaining: 0 });
  });
});
