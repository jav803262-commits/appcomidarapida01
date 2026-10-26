// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, useCart } from "@/context/CartContext";
import { makeExtra, makeLine, makeProduct } from "../unit/fixtures";

const burger = makeProduct("burger", 89);

function Probe() {
  const { items, totalItems, subtotal, addItem, increaseQuantity, decreaseQuantity, clearCart } = useCart();
  return (
    <div>
      <p data-testid="total-items">{totalItems}</p>
      <p data-testid="subtotal">{subtotal}</p>
      <p data-testid="lines">{items.length}</p>
      <button onClick={() => addItem(burger)}>add</button>
      <button onClick={() => addItem(burger, [makeExtra("queso", 10)])}>add-queso</button>
      <button onClick={() => items[0] && increaseQuantity(items[0].lineId)}>inc</button>
      <button onClick={() => items[0] && decreaseQuantity(items[0].lineId)}>dec</button>
      <button onClick={clearCart}>clear</button>
    </div>
  );
}
const renderCart = () => render(<CartProvider><Probe /></CartProvider>);
const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => localStorage.clear());

describe("CartProvider", () => {
  it("agrupa el mismo producto con los mismos extras y separa líneas con extras distintos", async () => {
    renderCart();
    await userEvent.click(screen.getByText("add"));
    await userEvent.click(screen.getByText("add"));
    expect(text("lines")).toBe("1");
    expect(text("total-items")).toBe("2");
    await userEvent.click(screen.getByText("add-queso"));
    expect(text("lines")).toBe("2");
    expect(text("subtotal")).toBe(String(89 * 2 + 99));
  });

  it("limita la cantidad de una línea a 50 (igual que create_order)", async () => {
    localStorage.setItem("food-menu-cart", JSON.stringify([makeLine(89, 50)]));
    renderCart();
    await waitFor(() => expect(text("lines")).toBe("1"));
    await userEvent.click(screen.getByText("inc"));
    expect(text("total-items")).toBe("50");
  });

  it("quitar la última unidad elimina la línea", async () => {
    renderCart();
    await userEvent.click(screen.getByText("add"));
    await userEvent.click(screen.getByText("dec"));
    expect(text("lines")).toBe("0");
  });

  it("persiste en localStorage y se recupera al recargar", async () => {
    const first = renderCart();
    await userEvent.click(screen.getByText("add"));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("food-menu-cart")!)).toHaveLength(1));
    first.unmount();
    renderCart();
    await waitFor(() => expect(text("total-items")).toBe("1"));
  });

  it("ignora y descarta datos corruptos del almacenamiento", async () => {
    localStorage.setItem("food-menu-cart", "{no es json");
    renderCart();
    await waitFor(() => expect(text("lines")).toBe("0"));
    await userEvent.click(screen.getByText("add"));
    expect(text("total-items")).toBe("1");
  });

  it("descarta líneas con forma inválida pero conserva las válidas", async () => {
    localStorage.setItem("food-menu-cart", JSON.stringify([{ foo: 1 }, makeLine(89, 2)]));
    renderCart();
    await waitFor(() => expect(text("total-items")).toBe("2"));
    expect(text("lines")).toBe("1");
  });

  it("clearCart vacía el carrito", async () => {
    renderCart();
    await userEvent.click(screen.getByText("add"));
    await userEvent.click(screen.getByText("clear"));
    expect(text("lines")).toBe("0");
  });
});
