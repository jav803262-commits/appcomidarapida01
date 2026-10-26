// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider } from "@/context/CartContext";
import { OrderForm } from "@/components/order/OrderForm";
import type { Order } from "@/types";
import { makeLine, makeSettings } from "../unit/fixtures";

const serverReply = {
  orderNumber: "ABC234", subtotal: 89, deliveryFee: 0, total: 89,
  createdAt: "2026-10-24T12:00:00Z", status: "pending", duplicate: false,
};

function mockFetch(reply: { ok: boolean; status?: number; body: unknown }) {
  const fn = vi.fn().mockResolvedValue({ ok: reply.ok, status: reply.status ?? (reply.ok ? 200 : 500), json: async () => reply.body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function renderForm(settings = makeSettings()) {
  localStorage.setItem("food-menu-cart", JSON.stringify([makeLine(89, 1)]));
  const onComplete = vi.fn<(order: Order) => void>();
  render(<CartProvider><OrderForm settings={settings} onBack={() => {}} onComplete={onComplete} /></CartProvider>);
  // El carrito se hidrata en un efecto: esperar a que el total aparezca en el botón.
  await screen.findByRole("button", { name: /Realizar pedido · \$89\.00/ });
  return { onComplete };
}

async function fillBasics(phone = "5512345678") {
  await userEvent.type(screen.getByPlaceholderText("Tu nombre"), "Ana Pérez");
  await userEvent.type(screen.getByPlaceholderText("Ej. 9511234567"), phone);
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe("OrderForm · pedido por transferencia", () => {
  it("entrega al ticket los datos bancarios que devuelve la API", async () => {
    const fetchMock = mockFetch({ ok: true, body: { ...serverReply, transfer: { bank: "B", holder: "H", account: "123456" } } });
    const { onComplete } = await renderForm();
    await fillBasics();
    await userEvent.click(screen.getByText("Transferencia").closest("button")!);
    await userEvent.click(screen.getByRole("button", { name: /Realizar pedido/ }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const order = onComplete.mock.calls[0][0];
    expect(order.id).toBe("ABC234");
    expect(order.transfer).toEqual({ bank: "B", holder: "H", account: "123456" });

    // El cliente NO envía precios ni totales: solo IDs y cantidades (el servidor recalcula).
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.paymentMethod).toBe("transfer");
    expect(sent.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(sent)).not.toEqual(expect.arrayContaining(["total", "subtotal", "price"]));
    expect(Object.keys(sent.items[0]).sort()).toEqual(["extraIds", "productId", "quantity"]);
  });

  it("en efectivo el pedido no lleva datos bancarios", async () => {
    mockFetch({ ok: true, body: { ...serverReply, transfer: null } });
    const { onComplete } = await renderForm();
    await fillBasics();
    await userEvent.type(screen.getByPlaceholderText(/Mínimo \$/), "100");
    await userEvent.click(screen.getByRole("button", { name: /Realizar pedido/ }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0][0].transfer).toBeUndefined();
  });
});

describe("OrderForm · errores", () => {
  it("muestra el mensaje del servidor cuando se supera el límite anti-abuso (429)", async () => {
    mockFetch({ ok: false, status: 429, body: { message: "Ya tienes pedidos en proceso con este teléfono." } });
    const { onComplete } = await renderForm();
    await fillBasics();
    await userEvent.type(screen.getByPlaceholderText(/Mínimo \$/), "100");
    await userEvent.click(screen.getByRole("button", { name: /Realizar pedido/ }));
    expect(await screen.findByText(/Ya tienes pedidos en proceso/)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("un teléfono incompleto no se envía (la validación nativa lo bloquea antes que la API)", async () => {
    const fetchMock = mockFetch({ ok: true, body: serverReply });
    const { onComplete } = await renderForm();
    await fillBasics("55123");
    await userEvent.type(screen.getByPlaceholderText(/Mínimo \$/), "100");
    await userEvent.click(screen.getByRole("button", { name: /Realizar pedido/ }));
    expect(screen.getByPlaceholderText("Ej. 9511234567")).toBeInvalid();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("el campo de teléfono solo admite dígitos y un máximo de 10", async () => {
    await renderForm();
    const input = screen.getByPlaceholderText("Ej. 9511234567");
    await userEvent.type(input, "55-12 34a56789012");
    expect(input).toHaveValue("5512345678");
  });

  it("no deja pagar con efectivo menor al total", async () => {
    const fetchMock = mockFetch({ ok: true, body: serverReply });
    const { onComplete } = await renderForm();
    await fillBasics();
    const cash = screen.getByPlaceholderText(/Mínimo \$/);
    await userEvent.type(cash, "50");
    await userEvent.click(screen.getByRole("button", { name: /Realizar pedido/ }));
    expect(cash).toBeInvalid();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("si el negocio pausó los pedidos, no envía nada", async () => {
    const fetchMock = mockFetch({ ok: true, body: serverReply });
    await renderForm(makeSettings({ orderingEnabled: false }));
    await fillBasics();
    await userEvent.type(screen.getByPlaceholderText(/Mínimo \$/), "100");
    await userEvent.click(screen.getByRole("button", { name: /Realizar pedido/ }));
    expect(await screen.findByText(/pausados/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
