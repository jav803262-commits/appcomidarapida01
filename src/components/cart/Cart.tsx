"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { CartItem } from "./CartItem";

interface Props {
  onBack: () => void;
  onContinue: () => void;
  canOrder?: boolean;
}

export function Cart({ onBack, onContinue, canOrder = true }: Props) {
  const { items, subtotal, clearCart } = useCart();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  function confirmClear() {
    clearCart();
    setShowClearConfirm(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-12">
      <button
        onClick={onBack}
        className="mb-6 text-sm font-bold text-zinc-500"
      >
        ← Volver al menú
      </button>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Tu pedido</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Revisa cantidades antes de continuar.
          </p>
        </div>

        {items.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-xs font-bold text-red-600"
          >
            Vaciar
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-white p-8 text-center ring-1 ring-zinc-200">
          <div className="text-5xl">🛒</div>
          <h2 className="mt-4 text-xl font-black">
            Tu carrito está vacío
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Agrega productos para comenzar tu pedido.
          </p>

          <button
            onClick={onBack}
            className="mt-6 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-black text-white"
          >
            Ver menú
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <CartItem key={item.lineId} item={item} />
            ))}
          </div>

          <div className="mt-6 rounded-3xl bg-zinc-950 p-5 text-white">
            <div className="flex justify-between text-zinc-300">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(0)}</span>
            </div>

            <div className="mt-2 flex justify-between text-xl font-black">
              <span>Total</span>
              <span>${subtotal.toFixed(0)}</span>
            </div>
          </div>

          {!canOrder && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Los pedidos están pausados o el negocio está fuera de horario. Puedes conservar tu carrito y volver más tarde.</p>}
          <button
            onClick={onContinue}
            disabled={!canOrder}
            className="mt-4 w-full rounded-2xl bg-red-600 px-5 py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar
          </button>
        </>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black">
              ¿Vaciar el pedido?
            </h2>
            <p className="mt-2 text-sm leading-5 text-zinc-500">
              Se eliminarán todos los productos que agregaste.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-black"
              >
                Cancelar
              </button>

              <button
                onClick={confirmClear}
                className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white"
              >
                Vaciar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
