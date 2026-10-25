import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPendingOrderRequest, getOrderRequestId } from "@/lib/order-request";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

beforeEach(() => vi.stubGlobal("sessionStorage", fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

const payloadA = { items: [{ productId: 1, quantity: 1 }], customer: { name: "Ana" } };
const payloadB = { items: [{ productId: 1, quantity: 2 }], customer: { name: "Ana" } };

describe("idempotencia del pedido (clientRequestId)", () => {
  it("el mismo payload conserva el mismo identificador (doble clic / reintento)", () => {
    const first = getOrderRequestId(payloadA);
    expect(getOrderRequestId(payloadA, first).id).toBe(first.id);
  });

  it("recupera el identificador tras recargar la página (sessionStorage)", () => {
    const first = getOrderRequestId(payloadA);
    expect(getOrderRequestId(payloadA, null).id).toBe(first.id);
  });

  it("un payload distinto genera un identificador nuevo", () => {
    const first = getOrderRequestId(payloadA);
    expect(getOrderRequestId(payloadB, first).id).not.toBe(first.id);
  });

  it("después de confirmar, el siguiente pedido es una solicitud nueva", () => {
    const first = getOrderRequestId(payloadA);
    clearPendingOrderRequest();
    expect(getOrderRequestId(payloadA, null).id).not.toBe(first.id);
  });

  it("si sessionStorage falla, no rompe el flujo", () => {
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    vi.stubGlobal("sessionStorage", broken);
    expect(() => getOrderRequestId(payloadA)).not.toThrow();
    expect(() => clearPendingOrderRequest()).not.toThrow();
  });

  it("ignora datos corruptos guardados en sessionStorage", () => {
    sessionStorage.setItem("food-menu-pending-order-request", "{no es json");
    expect(getOrderRequestId(payloadA).id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
