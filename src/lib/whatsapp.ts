import type { Order } from "@/types";

/**
 * WhatsApp is only the notification channel.
 * The complete order is already persisted in Supabase before this link is opened.
 */
export function createWhatsAppMessage(order: Order) {
  return [
    `Hola, realicé un pedido en el menú de ${"Toritos Burger"}.`,
    "",
    `Folio: ${order.id}`,
    `Nombre: ${order.customer.name}`,
    "",
    "¿Me pueden confirmar que recibieron mi pedido?",
  ].join("\n");
}

export function createWhatsAppLink(phone: string, order: Order) {
  const message = createWhatsAppMessage(order);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
