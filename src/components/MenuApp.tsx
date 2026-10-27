"use client";

import { useEffect, useState } from "react";
import { CartProvider, useCart } from "@/context/CartContext";
import { Header } from "@/components/layout/Header";
import { Menu } from "@/components/menu/Menu";
import { Cart } from "@/components/cart/Cart";
import { OrderForm } from "@/components/order/OrderForm";
import { OrderTicket } from "@/components/order/OrderTicket";
import type { CatalogData, Order } from "@/types";

export type AppStep = "menu" | "cart" | "form" | "ticket";

export function MenuApp() {
  return (
    <CartProvider>
      <MenuAppContent />
    </CartProvider>
  );
}

function MenuAppContent() {
  const [step, setStep] = useState<AppStep>("menu");
  const [order, setOrder] = useState<Order | null>(null);
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [error, setError] = useState("");
  const { clearCart } = useCart();

  useEffect(() => {
    if (catalog) document.title = `${catalog.settings.name} | Menú`;
  }, [catalog]);

  useEffect(() => {
    try {
      const savedOrder = sessionStorage.getItem("food-menu-active-order");
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as Order;
        if (parsed?.id && parsed?.customer?.name) {
          setOrder(parsed);
          setStep("ticket");
          clearCart();
        } else {
          sessionStorage.removeItem("food-menu-active-order");
        }
      }
    } catch {
      sessionStorage.removeItem("food-menu-active-order");
    }
  // Restore the already-created receipt once per page load.
  // clearCart writes through to localStorage so the purchase cannot reappear.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "No fue posible cargar el menú.");
        return data as CatalogData;
      })
      .then(setCatalog)
      .catch(() => setError("No fue posible cargar el menú. Revisa la conexión con Supabase."));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 text-zinc-900">
        {!catalog && !error && <LoadingScreen />}

        {error && (
          <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
            <div className="w-full rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-zinc-200">
              <div className="text-4xl">⚠️</div>
              <h1 className="mt-4 text-xl font-black">No se pudo cargar el menú</h1>
              <p className="mt-2 text-sm text-zinc-500">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-5 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-black text-white"
              >
                Intentar de nuevo
              </button>
            </div>
          </main>
        )}

        {catalog && (
          <>
            <Header
              onCart={() => setStep("cart")}
              businessName={catalog.settings.name}
              showCart={step !== "ticket"}
            />
            {catalog.settings.businessHoursEnabled && !catalog.settings.businessOpen && (
              <div className="mx-auto max-w-5xl px-4 pt-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <strong>Estamos fuera de horario.</strong> Puedes revisar el menú, pero no podremos registrar pedidos hasta la próxima apertura.
                </div>
              </div>
            )}
            {!catalog.settings.orderingEnabled && (!catalog.settings.businessHoursEnabled || catalog.settings.businessOpen) && (
              <div className="mx-auto max-w-5xl px-4 pt-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <strong>Pedidos temporalmente pausados.</strong> Puedes revisar el menú, pero por ahora no aceptamos pedidos.
                </div>
              </div>
            )}

            {step === "menu" && (
              <Menu
                catalog={catalog}
                onOpenCart={() => setStep("cart")}
              />
            )}

            {step === "cart" && (
              <Cart
                onBack={() => setStep("menu")}
                onContinue={() => setStep("form")}
                canOrder={catalog.settings.orderingEnabled}
              />
            )}

            {step === "form" && (
              <OrderForm
                settings={catalog.settings}
                onBack={() => setStep("cart")}
                onComplete={(createdOrder) => {
                  sessionStorage.setItem("food-menu-active-order", JSON.stringify(createdOrder));
                  clearCart();
                  setOrder(createdOrder);
                  setStep("ticket");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}

            {step === "ticket" && order && (
              <OrderTicket
                order={order}
                settings={catalog.settings}
                onFinish={() => {
                  sessionStorage.removeItem("food-menu-active-order");
                  window.location.reload();
                }}
              />
            )}
          </>
        )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl">🍔</div>
        <p className="mt-4 text-sm font-bold text-zinc-500">Cargando menú...</p>
      </div>
    </main>
  );
}
