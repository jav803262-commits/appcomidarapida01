"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItem, Product, ProductExtra } from "@/types";
import { calculateSubtotal } from "@/lib/order";
import { createClientId } from "@/lib/ids";

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (product: Product, extras?: ProductExtra[]) => void;
  removeItem: (lineId: string) => void;
  increaseQuantity: (lineId: string) => void;
  decreaseQuantity: (lineId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "food-menu-cart";

function extrasKey(extras: ProductExtra[]) {
  return extras.map((extra) => extra.id).sort().join(",");
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        setItems(parsed.filter((item) => item?.product?.id && item?.lineId && Array.isArray(item.extras)));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const addItem = (product: Product, selectedExtras: ProductExtra[] = []) => {
      const key = extrasKey(selectedExtras);
      setItems((current) => {
        const existing = current.find((item) => item.product.id === product.id && extrasKey(item.extras) === key);
        if (existing) return current.map((item) => item.lineId === existing.lineId ? { ...item, quantity: Math.min(50, item.quantity + 1) } : item);
        return [...current, { lineId: createClientId(), product, quantity: 1, extras: selectedExtras }];
      });
    };
    const removeItem = (lineId: string) => setItems((current) => current.filter((item) => item.lineId !== lineId));
    const increaseQuantity = (lineId: string) => setItems((current) => current.map((item) => item.lineId === lineId ? { ...item, quantity: Math.min(50, item.quantity + 1) } : item));
    const decreaseQuantity = (lineId: string) => setItems((current) => current.map((item) => item.lineId === lineId ? { ...item, quantity: item.quantity - 1 } : item).filter((item) => item.quantity > 0));
    return {
      items,
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: calculateSubtotal(items),
      addItem,
      removeItem,
      increaseQuantity,
      decreaseQuantity,
      clearCart: () => {
        setItems([]);
        try {
          localStorage.setItem(STORAGE_KEY, "[]");
        } catch {
          // The in-memory cart is still cleared if storage is unavailable.
        }
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe utilizarse dentro de CartProvider");
  return context;
}
