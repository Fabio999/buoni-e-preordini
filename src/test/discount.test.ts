import { describe, expect, it } from "vitest";
import { bookingTotal, discountPercent } from "@/lib/data";

const b = { booking_items: [{ unit_price: 10, quantity: 1 }, { unit_price: 10, quantity: 1 }] } as never;

describe("sconto prenotazione", () => {
  it("10+10 con totale 17 dà sconto 15%", () => {
    expect(discountPercent(20, 3)).toBe(15);
  });
  it("il totale sottrae lo sconto", () => {
    expect(bookingTotal({ ...(b as object), discount: 3 } as never)).toBe(17);
  });
});
