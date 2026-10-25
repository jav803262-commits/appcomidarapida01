"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TrackingResult = {
  orderNumber: string;
  status: string;
  createdAt: string;
  estimatedMinutes: number;
  updatedAt: string;
};

const statusText: Record<string, { label: string; description: string; icon: string; style: string }> = {
  pending: { label: "Pendiente de confirmación", description: "El negocio recibió el pedido y debe confirmar que puede prepararlo.", icon: "◷", style: "border-amber-200 bg-amber-50 text-amber-950" },
  confirmed: { label: "Pedido confirmado", description: "El negocio confirmó tu pedido.", icon: "✓", style: "border-blue-200 bg-blue-50 text-blue-950" },
  preparing: { label: "En preparación", description: "Tu pedido se está preparando.", icon: "♨", style: "border-orange-200 bg-orange-50 text-orange-950" },
  ready: { label: "Pedido listo", description: "Tu pedido está listo. Si elegiste domicilio, el negocio te indicará cómo continúa la entrega.", icon: "✓", style: "border-emerald-200 bg-emerald-50 text-emerald-950" },
  delivered: { label: "Pedido entregado", description: "El pedido figura como entregado.", icon: "✓✓", style: "border-emerald-200 bg-emerald-50 text-emerald-950" },
  cancelled: { label: "Pedido cancelado", description: "Contacta al negocio si necesitas más información.", icon: "×", style: "border-red-200 bg-red-50 text-red-950" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ConsultOrderPage() {
  const [folio, setFolio] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialFolio = params.get("folio");
    if (initialFolio) setFolio(initialFolio.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6));
  }, []);

  const trackedOrderNumber = result?.orderNumber;

  useEffect(() => {
    if (!trackedOrderNumber || !phoneLast4) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/orders/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ folio: trackedOrderNumber, phoneLast4 }),
        });
        if (response.ok) setResult(await response.json() as TrackingResult);
      } catch {
        // Keep the last known status if a background refresh fails.
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [trackedOrderNumber, phoneLast4]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ folio: folio.trim().toUpperCase(), phoneLast4 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No fue posible consultar el pedido.");
      setResult(data as TrackingResult);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible consultar el pedido.");
    } finally {
      setLoading(false);
    }
  }

  const currentStatus = result ? statusText[result.status] ?? { label: "Estado actualizado", description: "Consulta nuevamente más tarde para ver cambios.", icon: "•", style: "border-zinc-200 bg-zinc-50 text-zinc-950" } : null;

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-10">
      <Link href="/" className="text-sm font-bold text-zinc-500 hover:text-zinc-900">← Volver al menú</Link>
      <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
        <div className="text-4xl" aria-hidden="true">🍔</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Consulta tu pedido</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Ingresa tu folio y los últimos cuatro dígitos del teléfono que registraste al hacer el pedido.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-bold">Folio de 6 caracteres
            <input value={folio} onChange={(event) => setFolio(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6))} placeholder="Ej. 7K2M8Q" autoCapitalize="characters" autoComplete="off" required minLength={6} maxLength={6} className="field mt-2 uppercase tracking-widest" />
          </label>
          <label className="block text-sm font-bold">Últimos 4 dígitos de tu teléfono
            <input value={phoneLast4} onChange={(event) => setPhoneLast4(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Ej. 5941" inputMode="numeric" autoComplete="off" required minLength={4} maxLength={4} pattern="[0-9]{4}" className="field mt-2 tracking-widest" />
          </label>
          <button disabled={loading} type="submit" className="w-full rounded-2xl bg-zinc-900 px-5 py-4 font-black text-white disabled:opacity-60">{loading ? "Consultando…" : "Consultar estado"}</button>
        </form>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {result && currentStatus && (
          <section aria-live="polite" className="mt-6 rounded-2xl border border-zinc-200 bg-stone-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Folio</p>
            <p className="mt-1 text-2xl font-black tracking-widest">{result.orderNumber}</p>
            <div className={`mt-4 rounded-xl border p-4 ${currentStatus.style}`} aria-live="polite">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-xl font-black" aria-hidden="true">{currentStatus.icon}</span>
                <div><p className="text-lg font-black">{currentStatus.label}</p>
                <p className="mt-1 text-sm leading-5 opacity-90">{currentStatus.description}</p></div>
              </div>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Registrado</dt><dd className="text-right font-semibold">{formatDate(result.createdAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Tiempo estimado inicial</dt><dd className="font-semibold">{result.estimatedMinutes} min</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-zinc-500">Última actualización</dt><dd className="text-right font-semibold">{formatDate(result.updatedAt)}</dd></div>
            </dl>
            <button type="button" onClick={() => { setResult(null); setError(""); }} className="mt-5 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold">Consultar otro folio</button>
          </section>
        )}
      </section>
      <p className="mt-4 text-center text-xs leading-5 text-zinc-500">Para consultar se verifica tu folio y los últimos cuatro dígitos del teléfono. Esta consulta solo muestra el folio, estado, fecha y tiempo estimado. No muestra datos personales, productos, dirección ni importe.</p>
    </main>
  );
}
