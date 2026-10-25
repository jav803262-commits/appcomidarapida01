"use client";

import type { BusinessSettings, Order } from "@/types";
import { createWhatsAppLink } from "@/lib/whatsapp";

interface Props {
  order: Order;
  settings: BusinessSettings;
  onFinish: () => void;
}

export function OrderTicket({ order, settings, onFinish }: Props) {
  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      window.alert("Copiado al portapapeles.");
    } catch {
      window.alert("No se pudo copiar automáticamente. Mantén pulsado el dato para copiarlo.");
    }
  }

  function sendToWhatsApp() {
    // The order is already stored in Supabase. Repeated clicks reuse this same folio.
    window.location.href = createWhatsAppLink(settings.whatsapp, order);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8 pb-12">
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200">
        <div className="p-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl text-emerald-700">
            ✓
          </div>
          <p className="mt-4 text-sm font-bold uppercase tracking-wide text-emerald-700">
            Pedido registrado
          </p>
          <h1 className="mt-2 text-2xl font-black text-zinc-950">{settings.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Tu pedido quedó guardado en el sistema. Conserva tu folio para consultar su estado.
          </p>
        </div>

        <div className="mx-6 border-t border-dashed border-zinc-300" />

        <div className="px-6 py-7 text-center">
          <p className="text-sm text-zinc-500">Tu folio de pedido</p>
          <p className="mt-2 select-all text-4xl font-black tracking-widest text-zinc-950">
            {order.id}
          </p>
          <button type="button" onClick={() => copyText(order.id)} className="mt-3 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-700">Copiar folio</button>
          <p className="mt-4 text-sm text-zinc-500">Nombre del cliente</p>
          <p className="mt-1 text-xl font-bold text-zinc-900">{order.customer.name}</p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Puedes compartir tu folio por WhatsApp o llamar al negocio. No necesitas WhatsApp para conservar ni consultar tu pedido.
          </p>
        </div>
      </section>

      {order.customer.paymentMethod === "transfer" && (
        <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-black text-amber-950">Datos para tu transferencia</h2>
          <p className="mt-1 text-sm leading-5 text-amber-900">Realiza la transferencia por el importe indicado y comparte el comprobante con el negocio por un medio de contacto disponible para que pueda revisarlo.</p>
          <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-amber-200">
            <TransferDatum label="Banco" value={settings.transfer.bank} onCopy={copyText} />
            <TransferDatum label="Beneficiario" value={settings.transfer.holder} onCopy={copyText} />
            <TransferDatum label="Cuenta / CLABE" value={settings.transfer.account} onCopy={copyText} />
            <div className="border-t border-zinc-200 pt-3">
              <p className="text-zinc-500">Importe</p>
              <p className="mt-1 text-2xl font-black">${order.total.toFixed(2)} MXN</p>
            </div>
          </div>
        </section>
      )}

      <div className="mt-5 space-y-3">
        {settings.whatsapp.replace(/\D/g, "").length > 0 && (
          <button
            type="button"
            onClick={sendToWhatsApp}
            className="w-full rounded-2xl bg-green-600 px-5 py-4 font-black text-white transition hover:bg-green-700"
          >
            📲 Enviar folio por WhatsApp
          </button>
        )}

        {settings.phone.replace(/\D/g, "").length > 0 && (
          <a
            href={`tel:${settings.phone.replace(/\D/g, "")}`}
            className="block w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-center font-bold text-zinc-900 transition hover:bg-zinc-50"
          >
            ☎️ Llamar a {settings.name}
          </a>
        )}

        <button
          type="button"
          onClick={() => { window.location.href = `/pedido/consultar?folio=${encodeURIComponent(order.id)}`; }}
          className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 font-bold text-zinc-900 transition hover:bg-zinc-50"
        >
          Consultar estado de mi pedido
        </button>

        <button
          type="button"
          onClick={onFinish}
          className="w-full rounded-2xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-700"
        >
          🛍️ Realizar otro pedido
        </button>
      </div>

      <p className="mt-5 text-center text-xs leading-5 text-zinc-400">
        WhatsApp abrirá un mensaje con tu folio y nombre. Debes pulsar «Enviar»
        dentro de WhatsApp. Abrir WhatsApp no significa que el negocio haya confirmado tu pedido.
      </p>
      <p className="mt-3 text-center text-xs text-zinc-500">
        ¿Necesitas corregir algo? Contacta al negocio e indica tu folio. Al realizar otro pedido, este pedido permanecerá guardado y se generará un folio distinto para la nueva compra.
      </p>
    </main>
  );
}


function TransferDatum({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string) => void }) {
  if (!value.trim()) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-zinc-500">{label}</p>
        <p className="mt-1 break-words font-bold text-zinc-900">{value}</p>
      </div>
      <button type="button" onClick={() => onCopy(value)} className="shrink-0 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold">Copiar</button>
    </div>
  );
}
