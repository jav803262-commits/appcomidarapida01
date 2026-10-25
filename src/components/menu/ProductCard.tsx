"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, ProductExtra } from "@/types";
import { useCart } from "@/context/CartContext";
import { formatCurrency } from "@/lib/order";

export function ProductCard({ product, canOrder = true }: { product: Product; canOrder?: boolean }) {
  const { addItem, increaseQuantity, decreaseQuantity, items } = useCart();
  const [added, setAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const availableExtras = product.extras?.filter((extra) => extra.available) ?? [];
  const cartQuantity = items.filter((item) => item.product.id === product.id).reduce((sum, item) => sum + item.quantity, 0);
  const selectedExtras = useMemo(() => availableExtras.filter((extra) => selectedIds.includes(extra.id)), [availableExtras, selectedIds]);

  useEffect(() => {
    setImageFailed(false);
  }, [product.imageUrl]);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 900);
    return () => window.clearTimeout(timer);
  }, [added]);

  function add() {
    if (!canOrder) return;
    if (availableExtras.length > 0) { setCustomizing(true); return; }
    addItem(product, []);
    setAdded(true);
  }

  function confirmAdd() {
    if (!canOrder) return;
    addItem(product, selectedExtras);
    setSelectedIds([]);
    setCustomizing(false);
    setAdded(true);
  }

  return (
    <>
      <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200">
        <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-red-50 to-orange-100 text-6xl sm:h-52">
          {product.imageUrl && !imageFailed ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-label={`Sin fotografía: ${product.name}`}>{product.emoji}</span>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3"><h3 className="font-black">{product.name}</h3><span className="whitespace-nowrap font-black">{formatCurrency(product.price)}</span></div>
          <p className="mt-2 min-h-10 text-sm leading-5 text-zinc-500">{product.description}</p>
          {availableExtras.length > 0 && <p className="mt-2 text-xs font-semibold text-zinc-500">Personalizable · {availableExtras.length} extras</p>}
          {!product.available ? <div className="mt-4 rounded-2xl bg-zinc-100 px-4 py-3 text-center text-sm font-black text-zinc-400">Agotado</div> : (
            <div className="mt-4 space-y-2">
              <button onClick={add} disabled={!canOrder} className={`w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:bg-zinc-300 ${added ? "bg-green-600" : "bg-zinc-900 hover:bg-red-600"}`}>
                {!canOrder ? "Pedidos no disponibles" : added ? "✓ Agregado" : availableExtras.length ? "Personalizar y agregar" : "Agregar al pedido"}
              </button>
              {cartQuantity > 0 && <p className="text-center text-xs text-zinc-500">En tu pedido: {cartQuantity}</p>}
              {!availableExtras.length && cartQuantity > 0 && <div className="flex justify-center gap-3"><button onClick={() => decreaseQuantity(items.find((item) => item.product.id === product.id)?.lineId ?? "")} className="h-9 w-9 rounded-full bg-zinc-100 font-black" aria-label={`Disminuir ${product.name}`}>−</button><button onClick={() => increaseQuantity(items.find((item) => item.product.id === product.id)?.lineId ?? "")} className="h-9 w-9 rounded-full bg-zinc-900 font-black text-white" aria-label={`Aumentar ${product.name}`}>+</button></div>}
            </div>
          )}
        </div>
      </article>
      {customizing && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={`Personalizar ${product.name}`}>
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Personaliza tu {product.name}</h2><p className="mt-1 text-sm text-zinc-500">Selecciona los extras que quieras.</p></div><button onClick={() => setCustomizing(false)} className="rounded-full bg-zinc-100 px-3 py-2 font-bold" aria-label="Cerrar">✕</button></div>
          <div className="mt-5 space-y-3">{availableExtras.map((extra: ProductExtra) => <label key={extra.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 p-4"><input type="checkbox" checked={selectedIds.includes(extra.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, extra.id] : current.filter((id) => id !== extra.id))} className="h-5 w-5 accent-red-600"/><span className="flex-1 font-semibold">{extra.name}</span><span className="text-sm font-bold">+{formatCurrency(extra.price)}</span></label>)}</div>
          <div className="mt-5 flex items-center justify-between border-t border-zinc-200 pt-4"><span className="text-sm text-zinc-500">Precio unitario</span><strong className="text-lg">{formatCurrency(product.price + selectedExtras.reduce((sum, extra) => sum + extra.price, 0))}</strong></div>
          <button onClick={confirmAdd} disabled={!canOrder} className="mt-4 w-full rounded-2xl bg-red-600 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Agregar al pedido</button>
        </div>
      </div>}
    </>
  );
}
