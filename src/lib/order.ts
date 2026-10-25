import type { CartItem } from "@/types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export function getCartLineUnitPrice(item: Pick<CartItem, "product" | "extras">) {
  return item.product.price + item.extras.reduce((sum, extra) => sum + extra.price, 0);
}

export function calculateSubtotal(items: CartItem[]) {
  return items.reduce((total, item) => total + getCartLineUnitPrice(item) * item.quantity, 0);
}

export function calculateDeliveryFee(orderType: "pickup" | "delivery", fee: number) {
  return orderType === "delivery" ? fee : 0;
}

export function calculateTotal(subtotal: number, deliveryFee: number) {
  return subtotal + deliveryFee;
}

export function generateOrderId() {
  const date = new Date();
  const datePart = `${date.getDate()}`.padStart(2, "0") + `${date.getMonth() + 1}`.padStart(2, "0");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${datePart}-${randomPart}`;
}
