// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/navigation", () => ({ navigateTo: vi.fn() }));
import { navigateTo } from "@/lib/navigation";
import { OrderTicket } from "@/components/order/OrderTicket";
import { makeOrder, makeSettings } from "../unit/fixtures";

const transferOrder = () =>
  makeOrder({
    customer: { name: "Ana Pérez", phone: "5512345678", orderType: "pickup", paymentMethod: "transfer" },
    total: 89,
    transfer: { bank: "BANCO PRUEBA", holder: "TITULAR PRUEBA", account: "012345678901234567" },
  });

beforeEach(() => vi.mocked(navigateTo).mockClear());

describe("OrderTicket · datos bancarios", () => {
  it("en un pedido por transferencia muestra los datos que llegaron con el pedido", () => {
    render(<OrderTicket order={transferOrder()} settings={makeSettings()} onFinish={() => {}} />);
    expect(screen.getByText("Datos para tu transferencia")).toBeInTheDocument();
    expect(screen.getByText("BANCO PRUEBA")).toBeInTheDocument();
    expect(screen.getByText("TITULAR PRUEBA")).toBeInTheDocument();
    expect(screen.getByText("012345678901234567")).toBeInTheDocument();
    expect(screen.getByText(/\$89\.00 MXN/)).toBeInTheDocument();
  });

  it("en un pedido en efectivo no muestra la sección", () => {
    render(<OrderTicket order={makeOrder()} settings={makeSettings()} onFinish={() => {}} />);
    expect(screen.queryByText("Datos para tu transferencia")).not.toBeInTheDocument();
  });

  it("si un pedido por transferencia no trae datos (comprobante antiguo), no falla ni muestra la sección", () => {
    const order = transferOrder();
    delete order.transfer;
    render(<OrderTicket order={order} settings={makeSettings()} onFinish={() => {}} />);
    expect(screen.queryByText("Datos para tu transferencia")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Realizar otro pedido/ })).toBeInTheDocument();
  });
});

describe("OrderTicket · acciones", () => {
  it("WhatsApp abre wa.me con el número limpio y el nombre del negocio", async () => {
    render(<OrderTicket order={makeOrder()} settings={makeSettings({ name: "Burgers del Norte" })} onFinish={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Enviar folio por WhatsApp/ }));
    const url = vi.mocked(navigateTo).mock.calls[0][0];
    expect(url.startsWith("https://wa.me/525512345678?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("Burgers del Norte");
    expect(text).toContain("Folio: ABC234");
  });

  it("no ofrece WhatsApp si el negocio no configuró número", () => {
    render(<OrderTicket order={makeOrder()} settings={makeSettings({ whatsapp: "" })} onFinish={() => {}} />);
    expect(screen.queryByRole("button", { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it("«Consultar estado» lleva a la consulta con el folio", async () => {
    render(<OrderTicket order={makeOrder()} settings={makeSettings()} onFinish={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Consultar estado/ }));
    expect(navigateTo).toHaveBeenCalledWith("/pedido/consultar?folio=ABC234");
  });

  it("«Realizar otro pedido» invoca onFinish", async () => {
    const onFinish = vi.fn();
    render(<OrderTicket order={makeOrder()} settings={makeSettings()} onFinish={onFinish} />);
    await userEvent.click(screen.getByRole("button", { name: /Realizar otro pedido/ }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
