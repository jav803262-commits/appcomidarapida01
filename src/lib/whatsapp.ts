import type { Order } from "@/types";

/**
 * WhatsApp is only the notification channel.
 * The complete order is already persisted in Supabase before this link is opened.
 */
export function createWhatsAppMessage(order: Order, businessName: string) {
  return [
    `Hola, realicé un pedido en el menú de ${businessName}.`,
    "",
    `Folio: ${order.id}`,
    `Nombre: ${order.customer.name}`,
    "",
    "¿Me pueden confirmar que recibieron mi pedido?",
  ].join("\n");
}

export function createWhatsAppLink(phone: string, order: Order, businessName: string) {
  const message = createWhatsAppMessage(order, businessName);
  // wa.me exige solo dígitos (con lada internacional): se descartan +, espacios y guiones.
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
