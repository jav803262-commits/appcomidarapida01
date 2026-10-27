"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { calculateDeliveryFee, calculateTotal } from "@/lib/order";
import { clearPendingOrderRequest, getOrderRequestId } from "@/lib/order-request";
import type { BusinessSettings, Order, OrderCustomer } from "@/types";

interface Props {
  settings: BusinessSettings;
  onBack: () => void;
  onComplete: (order: Order) => void;
}

export function OrderForm({ settings, onBack, onComplete }: Props) {
  const { items, subtotal } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderCustomer["orderType"]>(settings.pickupEnabled ? "pickup" : "delivery");
  const [paymentMethod, setPaymentMethod] = useState<OrderCustomer["paymentMethod"]>(settings.paymentMethods.cash ? "cash" : "transfer");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [reference, setReference] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{ id: string; fingerprint: string } | null>(null);

  const deliveryFee = calculateDeliveryFee(orderType, settings.deliveryFee);
  const total = calculateTotal(subtotal, deliveryFee);
  const cash = Number(cashAmount);
  const change = cash >= total ? cash - total : 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!settings.orderingEnabled) {
      setError("Los pedidos están pausados en este momento.");
      return;
    }

    if (!items.length) {
      setError("Tu carrito está vacío.");
      return;
    }

    if (!name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length !== 10) {
      setError("Escribe un teléfono válido de 10 dígitos.");
      return;
    }

    if (orderType === "pickup" && !settings.pickupEnabled) {
      setError("La recogida en el local ya no está disponible. Actualiza el menú e inténtalo de nuevo.");
      return;
    }
    if (orderType === "delivery" && !settings.deliveryEnabled) {
      setError("El servicio a domicilio ya no está disponible. Actualiza el menú e inténtalo de nuevo.");
      return;
    }
    if (paymentMethod === "cash" && !settings.paymentMethods.cash) {
      setError("El pago en efectivo ya no está disponible.");
      return;
    }
    if (paymentMethod === "transfer" && !settings.paymentMethods.transfer) {
      setError("La transferencia ya no está disponible.");
      return;
    }

    if (subtotal < settings.minOrderAmount) {
      setError(`El pedido mínimo es de $${settings.minOrderAmount.toFixed(2)}.`);
      return;
    }

    if (!settings.paymentMethods.cash && !settings.paymentMethods.transfer) {
      setError("El negocio no tiene métodos de pago habilitados. Contacta al establecimiento.");
      return;
    }

    if (orderType === "delivery" && (!street.trim() || !neighborhood.trim())) {
      setError("Para domicilio selecciona una colonia y escribe calle y número.");
      return;
    }
    if (orderType === "delivery" && settings.deliveryNeighborhoods.length > 0 && !settings.deliveryNeighborhoods.includes(neighborhood)) {
      setError("La colonia seleccionada no está dentro de la cobertura de entrega.");
      return;
    }

    if (paymentMethod === "cash" && (!cash || cash < total)) {
      setError("Indica una cantidad de efectivo igual o mayor al total.");
      return;
    }

    const payload = {
      customer: { name: name.trim(), phone: normalizedPhone },
      orderType,
      paymentMethod,
      cashAmount: paymentMethod === "cash" ? cash : undefined,
      items: items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        extraIds: item.extras.map((extra) => extra.id),
      })),
      address:
        orderType === "delivery"
          ? {
              street: street.trim(),
              neighborhood: neighborhood.trim(),
              reference: reference.trim() || undefined,
            }
          : undefined,
      notes: notes.trim() || undefined,
    };
    const pending = getOrderRequestId(payload, pendingRequest);
    setPendingRequest(pending);
    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, clientRequestId: pending.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible crear el pedido.");

      const createdOrder: Order = {
        id: data.orderNumber,
        items,
        customer: {
          name: name.trim(),
          phone: phone.replace(/\D/g, ""),
          orderType,
          paymentMethod,
          address:
            orderType === "delivery"
              ? {
                  street: street.trim(),
                  neighborhood: neighborhood.trim(),
                  reference: reference.trim() || undefined,
                }
              : undefined,
          cashAmount: paymentMethod === "cash" ? cash : undefined,
          notes: notes.trim() || undefined,
        },
        subtotal: Number(data.subtotal),
        deliveryFee: Number(data.deliveryFee),
        total: Number(data.total),
        createdAt: data.createdAt,
        status: data.status,
        transfer:
          paymentMethod === "transfer" && data.transfer
            ? {
                bank: String(data.transfer.bank ?? ""),
                holder: String(data.transfer.holder ?? ""),
                account: String(data.transfer.account ?? ""),
              }
            : undefined,
      };

      clearPendingOrderRequest();
      setPendingRequest(null);
      onComplete(createdOrder);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No fue posible crear el pedido.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 pb-12 sm:py-10">
      <button onClick={onBack} className="mb-6 text-sm font-bold text-zinc-500">
        ← Volver al carrito
      </button>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">{settings.name}</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Confirma tu pedido</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Revisa tus datos y realiza tu pedido. Al registrarlo, recibirás un folio para consultarlo después; WhatsApp es opcional.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <Field label="¿Cómo te llamas?">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" className="field" maxLength={100} required />
        </Field>

        <Field label="Teléfono de contacto (10 dígitos)">
          <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Ej. 9511234567" className="field" inputMode="numeric" autoComplete="tel-national" maxLength={10} minLength={10} pattern="[0-9]{10}" required aria-describedby="phone-help" />
          <p id="phone-help" className="mt-1 text-xs leading-5 text-zinc-500">Lo usaremos para contactarte si hay algún problema y verificar tu folio al consultar el pedido.</p>
        </Field>

        <Field label="¿Cómo recibirás tu pedido?">
          {!settings.pickupEnabled && !settings.deliveryEnabled && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Por ahora no hay modalidades de entrega disponibles.</p>}
          <div className="grid grid-cols-2 gap-3">
            {settings.pickupEnabled && (
              <Choice active={orderType === "pickup"} onClick={() => setOrderType("pickup")} title="Recoger" icon="🛍️" />
            )}
            {settings.deliveryEnabled && (
              <Choice active={orderType === "delivery"} onClick={() => setOrderType("delivery")} title="Domicilio" icon="🛵" />
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Tiempo estimado: {orderType === "delivery" ? settings.deliveryEtaMinutes : settings.pickupEtaMinutes} minutos.
          </p>
        </Field>

        {orderType === "delivery" && (
          <div className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
            <Field label="Calle y número">
              <input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Ej. Calle Principal #123" className="field" />
            </Field>
            <Field label="Colonia">
              {settings.deliveryNeighborhoods.length > 0 ? (
                <select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className="field" required>
                  <option value="">Selecciona tu colonia</option>
                  {settings.deliveryNeighborhoods.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              ) : (
                <div>
                  <input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="Cobertura no configurada" className="field" disabled required />
                  <p className="mt-1 text-xs text-red-700">El negocio aún no ha configurado las colonias de entrega. Contacta al establecimiento.</p>
                </div>
              )}
              <p className="mt-1 text-xs text-zinc-500">Solo puedes elegir colonias dentro de la zona de cobertura.</p>
            </Field>
            <Field label="Referencia (opcional)">
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Cerca de..." className="field" />
            </Field>
          </div>
        )}

        <Field label="Forma de pago">
          <div className="grid grid-cols-2 gap-3">
            {settings.paymentMethods.cash && (
              <Choice active={paymentMethod === "cash"} onClick={() => setPaymentMethod("cash")} title="Efectivo" icon="💵" />
            )}
            {settings.paymentMethods.transfer && (
              <Choice active={paymentMethod === "transfer"} onClick={() => setPaymentMethod("transfer")} title="Transferencia" icon="💳" />
            )}
          </div>
          {!settings.paymentMethods.cash && !settings.paymentMethods.transfer && <p className="mt-2 text-sm text-red-700">El negocio aún no ha habilitado una forma de pago.</p>}
        </Field>

        {paymentMethod === "cash" && (
          <Field label="¿Con cuánto pagarás?">
            <input type="number" min={total} step="1" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} placeholder={`Mínimo $${total}`} className="field" />
            {cash >= total && <p className="mt-2 text-sm font-bold text-green-700">Cambio: ${change.toFixed(0)}</p>}
          </Field>
        )}

        {paymentMethod === "transfer" && (
          <p className="rounded-2xl bg-blue-50 p-4 text-sm leading-5 text-blue-900">Los datos de transferencia se mostrarán después de registrar tu pedido, junto con el importe exacto.</p>
        )}

        <Field label="¿Alguna indicación?">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={200} rows={3} placeholder="Ej. Sin cebolla, por favor." className="field resize-none" />
        </Field>

        {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        <div className="rounded-3xl bg-zinc-950 p-5 text-white">
          {settings.minOrderAmount > 0 && <p className="mb-3 text-xs text-zinc-300">Pedido mínimo: ${settings.minOrderAmount.toFixed(2)}</p>}
          <div className="flex justify-between text-zinc-300"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          {deliveryFee > 0 && <div className="mt-2 flex justify-between text-zinc-300"><span>Envío</span><span>${deliveryFee.toFixed(2)}</span></div>}
          <div className="mt-3 flex justify-between text-2xl font-black"><span>Total</span><span>${total.toFixed(2)}</span></div>
        </div>

        <button disabled={submitting || (!settings.pickupEnabled && !settings.deliveryEnabled) || (!settings.paymentMethods.cash && !settings.paymentMethods.transfer) || (orderType === "delivery" && settings.deliveryNeighborhoods.length === 0)} type="submit" className="w-full rounded-2xl bg-red-600 px-5 py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Registrando pedido..." : `Realizar pedido · $${total.toFixed(2)}`}
        </button>
      </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-black">{label}</span>{children}</label>;
}

function Choice({ active, onClick, title, icon }: { active: boolean; onClick: () => void; title: string; icon: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl p-4 text-left ring-1 transition ${active ? "bg-red-50 ring-red-500" : "bg-white ring-zinc-200"}`}>
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-black">{title}</div>
    </button>
  );
}
