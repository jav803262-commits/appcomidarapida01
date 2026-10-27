import type { BusinessSettings, CartItem, Order, Product, ProductExtra } from "@/types";

export function makeExtra(id: string, price: number): ProductExtra {
  return { id, name: `Extra ${id}`, price, available: true };
}

export function makeProduct(id: string, price: number): Product {
  return {
    id, name: `Producto ${id}`, description: "", price, emoji: "🍔",
    category: "principales", available: true, extras: [],
  } as Product;
}

export function makeLine(price: number, quantity: number, extras: ProductExtra[] = []): CartItem {
  return { lineId: `l-${price}-${quantity}`, product: makeProduct("p1", price), quantity, extras };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ABC234",
    items: [makeLine(89, 1)],
    customer: { name: "Ana Pérez", phone: "5512345678", orderType: "pickup", paymentMethod: "cash" },
    subtotal: 89, deliveryFee: 0, total: 89, createdAt: "2026-10-24T12:00:00Z",
    ...overrides,
  } as Order;
}

export function makeSettings(overrides: Partial<BusinessSettings> = {}): BusinessSettings {
  return {
    name: "Negocio de Prueba", description: "", phone: "5511112222", whatsapp: "+52 55 1234 5678",
    address: "", currency: "MXN", orderingEnabled: true, businessOpen: true,
    businessHoursEnabled: false, schedule: {}, businessTimezone: "America/Mexico_City",
    deliveryEnabled: false, deliveryFee: 30, minOrderAmount: 0, deliveryEtaMinutes: 40, pickupEtaMinutes: 20,
    pickupEnabled: true, deliveryNeighborhoods: [], paymentMethods: { cash: true, transfer: true },
    ...overrides,
  };
}
