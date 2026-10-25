"use client";

import type { CartItem as CartItemType } from "@/types";
import { useCart } from "@/context/CartContext";
import { formatCurrency, getCartLineUnitPrice } from "@/lib/order";

export function CartItem({ item }: { item: CartItemType }) {
  const { increaseQuantity, decreaseQuantity, removeItem } = useCart();
  const unitPrice = getCartLineUnitPrice(item);
  return <div className="rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
    <div className="flex gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-3xl">{item.product.emoji}</div>
      <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><h2 className="font-black">{item.product.name}</h2><strong>{formatCurrency(unitPrice * item.quantity)}</strong></div>
        {item.extras.length > 0 && <ul className="mt-1 text-xs text-zinc-500">{item.extras.map((extra) => <li key={extra.id}>+ {extra.name} ({formatCurrency(extra.price)})</li>)}</ul>}
        <p className="mt-1 text-xs text-zinc-500">{formatCurrency(unitPrice)} por unidad</p>
        <div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={() => decreaseQuantity(item.lineId)} className="h-9 w-9 rounded-full bg-zinc-100 font-black" aria-label="Disminuir cantidad">−</button><span className="w-5 text-center font-black">{item.quantity}</span><button onClick={() => increaseQuantity(item.lineId)} className="h-9 w-9 rounded-full bg-zinc-900 font-black text-white" aria-label="Aumentar cantidad">+</button></div><button onClick={() => removeItem(item.lineId)} className="text-xs font-bold text-red-600">Eliminar</button></div>
      </div>
    </div>
  </div>;
}
