import { describe, expect, it } from "vitest";
import { createWhatsAppLink, createWhatsAppMessage } from "@/lib/whatsapp";
import { makeOrder } from "./fixtures";

describe("mensaje de WhatsApp", () => {
  it("incluye negocio, folio y nombre", () => {
    const msg = createWhatsAppMessage(makeOrder(), "Toritos Burger");
    expect(msg).toContain("Toritos Burger");
    expect(msg).toContain("Folio: ABC234");
    expect(msg).toContain("Nombre: Ana Pérez");
  });

  it("NO incluye el detalle del pedido, importes ni teléfono", () => {
    const msg = createWhatsAppMessage(makeOrder({ total: 456 }), "Toritos Burger");
    expect(msg).not.toContain("456");
    expect(msg).not.toContain("5512345678");
  });

  it("usa saltos de línea reales", () => {
    expect(createWhatsAppMessage(makeOrder(), "X").split("\n").length).toBeGreaterThan(3);
  });
});

describe("enlace de WhatsApp", () => {
  it("codifica el texto en la URL", () => {
    const url = createWhatsAppLink("5215512345678", makeOrder(), "Toritos Burger");
    expect(url.startsWith("https://wa.me/5215512345678?text=")).toBe(true);
    expect(url).not.toContain(" ");
    expect(decodeURIComponent(url.split("?text=")[1])).toContain("Folio: ABC234");
  });

  it("limpia el número si se capturó con +, espacios o guiones", () => {
    const url = createWhatsAppLink("+52 55 1234-5678", makeOrder(), "X");
    expect(url.startsWith("https://wa.me/525512345678?text=")).toBe(true);
  });
});
