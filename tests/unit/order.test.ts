import { describe, expect, it } from "vitest";
import { calculateDeliveryFee, calculateSubtotal, calculateTotal, formatCurrency, getCartLineUnitPrice } from "@/lib/order";
import { makeExtra, makeLine } from "./fixtures";

describe("cálculo de importes (solo para mostrar; el servidor recalcula)", () => {
  it("suma los extras al precio unitario", () => {
    const line = makeLine(89, 1, [makeExtra("a", 10), makeExtra("b", 15)]);
    expect(getCartLineUnitPrice(line)).toBe(114);
  });

  it("multiplica por cantidad y suma varias líneas", () => {
    const items = [makeLine(89, 2), makeLine(39, 1, [makeExtra("a", 5)])];
    expect(calculateSubtotal(items)).toBe(89 * 2 + 44);
  });

  it("carrito vacío = 0", () => {
    expect(calculateSubtotal([])).toBe(0);
  });

  it("cobra envío solo a domicilio", () => {
    expect(calculateDeliveryFee("delivery", 25)).toBe(25);
    expect(calculateDeliveryFee("pickup", 25)).toBe(0);
  });

  it("total = subtotal + envío", () => {
    expect(calculateTotal(200, 25)).toBe(225);
  });

  it("formatea en pesos mexicanos", () => {
    expect(formatCurrency(1234.5)).toMatch(/1,234\.50/);
  });
});
