"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getAdminSession } from "@/lib/admin-session";

type Status = "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
type Method = "cash" | "transfer";
type Order = { id: string; order_number: string; customer_name: string; customer_phone: string | null; order_type: "pickup" | "delivery"; payment_method: Method; cash_amount: number | string | null; subtotal: number | string; delivery_fee: number | string; total: number | string; status: Status; created_at: string };
type Payment = { id: string; order_id: string; amount: number | string; method: Method; status: "active" | "reversed"; reference: string | null; cash_tendered: number | string | null; change_due: number | string; paid_at: string; created_at: string; received_by: string | null };
const money = (v: number | string | null | undefined) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v ?? 0));
const label: Record<Status, string> = { pending: "Pendiente", confirmed: "Confirmado", preparing: "Preparando", ready: "Listo", delivered: "Entregado", cancelled: "Cancelado" };

export default function CashierPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ready" | "all">("ready");
  const [cashTendered, setCashTendered] = useState<Record<string, string>>({});
  const [paymentMethodByOrder, setPaymentMethodByOrder] = useState<Record<string, Method>>({});
  const [transferReference, setTransferReference] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const admin = await getAdminSession();
    if (admin.status === "anonymous") { setEmail(""); setChecking(false); return; }
    if (admin.status === "forbidden") { setError("Tu cuenta no tiene permisos para acceder al panel operativo."); setChecking(false); return; }
    setEmail(admin.email);
    const [ordersResult, paymentsResult] = await Promise.all([
      supabaseBrowser.from("orders").select("id,order_number,customer_name,customer_phone,order_type,payment_method,cash_amount,subtotal,delivery_fee,total,status,created_at").in("status", ["pending", "confirmed", "preparing", "ready", "delivered"]).order("created_at", { ascending: false }).limit(100),
      supabaseBrowser.from("order_payments").select("id,order_id,amount,method,status,reference,cash_tendered,change_due,paid_at,created_at,received_by").order("paid_at", { ascending: false }).limit(300),
    ]);
    if (ordersResult.error) setError(`No se pudieron cargar los pedidos: ${ordersResult.error.message}`);
    else setOrders((ordersResult.data ?? []) as Order[]);
    if (paymentsResult.error) setError(`No se pudieron consultar los pagos. Verifica que la tabla order_payments exista y que la política de lectura esté aplicada: ${paymentsResult.error.message}`);
    else { setPayments((paymentsResult.data ?? []) as Payment[]); if (!ordersResult.error) setError(""); }
    setChecking(false);
  }, []);

  useEffect(() => { void load(); const { data: listener } = supabaseBrowser.auth.onAuthStateChange(() => { window.setTimeout(() => void load(), 0); }); const poll = window.setInterval(() => void load(), 15000); return () => { listener.subscription.unsubscribe(); window.clearInterval(poll); }; }, [load]);
  const activePaymentByOrder = useMemo(() => {
    const map = new Map<string, Payment>();
    for (const payment of payments) if (payment.status === "active" && !map.has(payment.order_id)) map.set(payment.order_id, payment);
    return map;
  }, [payments]);
  const shown = useMemo(() => filter === "ready" ? orders.filter(o => o.status === "ready") : orders, [filter, orders]);

  async function recordPayment(order: Order) {
    const method = paymentMethodByOrder[order.id] ?? order.payment_method;
    if (activePaymentByOrder.has(order.id)) { setError(`El pedido ${order.order_number} ya tiene un pago activo. No lo cobres de nuevo.`); return; }
    const methodChanged = method !== order.payment_method;
    if (methodChanged && !window.confirm(`El cliente eligió ${order.payment_method === "cash" ? "efectivo" : "transferencia"}. ¿Confirmas cambiar el método a ${method === "cash" ? "efectivo" : "transferencia"}?`)) return;
    let tender: number | null = null;
    let reference: string | null = null;
    if (method === "cash") {
      const raw = cashTendered[order.id] ?? String(order.cash_amount ?? "");
      tender = Number(raw);
      if (!raw.trim() || !Number.isFinite(tender) || tender < Number(order.total)) { setError(`Para el pedido ${order.order_number}, indica el efectivo recibido (mínimo ${money(order.total)}).`); return; }
    } else {
      if (!window.confirm("Confirma que revisaste tu cuenta bancaria y que el dinero de esta transferencia fue recibido. No registres una transferencia solo por ver un comprobante.")) return;
      reference = (transferReference[order.id] ?? "").trim();
      if (!reference) { setError(`Escribe la referencia de la transferencia para el pedido ${order.order_number}.`); return; }
    }
    setBusyId(order.id); setError("");
    const { error: rpcError } = await supabaseBrowser.rpc("record_order_payment", {
      p_order_id: order.id,
      p_method: method,
      p_confirm_method_change: methodChanged,
      p_transfer_verified: method === "transfer",
      p_reference: reference,
      p_cash_tendered: tender,
    });
    if (rpcError) setError(`No se registró el pago del pedido ${order.order_number}: ${rpcError.message}`);
    else { setError(""); await load(); }
    setBusyId(null);
  }

  async function markDelivered(order: Order) {
    if (!activePaymentByOrder.has(order.id)) { setError(`No puedes entregar el pedido ${order.order_number}: primero registra el pago recibido.`); return; }
    if (!window.confirm(`¿Confirmas que entregaste el pedido ${order.order_number}?`)) return;
    setBusyId(order.id); setError("");
    const { error: rpcError } = await supabaseBrowser.rpc("transition_order_status", { p_order_id: order.id, p_new_status: "delivered" });
    if (rpcError) setError(`No se pudo registrar la entrega: ${rpcError.message}`); else await load();
    setBusyId(null);
  }

  if (checking) return <main className="ops-shell"><p>Comprobando sesión…</p></main>;
  if (!email) return <main className="ops-shell"><section className="ops-login"><a href="/admin">← Volver al panel</a><h1>💳 Caja · Cobros y entregas</h1><p>{error || "Inicia sesión con tu cuenta de administrador para acceder."}</p><a className="ops-primary" href="/admin">Ir a iniciar sesión</a></section></main>;
  return <main className="ops-shell ops-cashier"><header className="ops-header"><a className="ops-brand" href="/admin"><span className="ops-logo">TB</span><span><strong>Toritos Burger</strong><small>Panel de caja</small></span></a><nav className="ops-nav"><a href="/admin/cocina">🍳 Cocina</a><a className="active" href="/admin/caja">💳 Caja</a><a href="/admin">📋 Centro de pedidos</a></nav><div className="ops-user"><span>{email}</span><button onClick={() => void supabaseBrowser.auth.signOut()}>Salir</button></div></header>
    <section className="ops-content"><div className="ops-title-row"><div><p className="ops-eyebrow">COBROS Y ENTREGA</p><h1>💳 Caja · Cobros y entregas</h1><p>Registra el dinero recibido, verifica transferencias y confirma la entrega solo cuando el pago esté registrado.</p></div><button className="ops-secondary" onClick={() => { setChecking(true); void load(); }}>↻ Actualizar pedidos</button></div>{error && <p className="ops-alert" role="alert">{error}</p>}
      <div className="ops-cashier-summary"><div><span>📦 Pedidos listos para entregar</span><strong>{orders.filter(o => o.status === "ready").length}</strong></div><div><span>✅ Pedidos con pago registrado</span><strong>{activePaymentByOrder.size}</strong><small>Solo pagos registrados en order_payments.</small></div></div>
      <div className="ops-filter-row"><div><h2>🧾 Cola de caja</h2><p>El método elegido no confirma que el dinero se haya recibido.</p></div><select value={filter} onChange={e => setFilter(e.target.value as "ready" | "all")}><option value="ready">Listos para entregar</option><option value="all">Todos los pedidos activos y entregados</option></select></div>
      {shown.length === 0 ? <section className="ops-empty"><span>💳</span><h2>📭 No hay pedidos pendientes de caja</h2><p>Cuando cocina marque un pedido como listo, aparecerá aquí.</p></section> : <div className="ops-cash-list">{shown.map(order => { const payment = activePaymentByOrder.get(order.id); const total = Number(order.total); return <article className="ops-cash-card" key={order.id}><div className="ops-cash-main"><div><span className="ops-folio">#{order.order_number}</span><span className={`ops-status status-${order.status}`}>{label[order.status]}</span></div><strong>{order.customer_name}</strong><small>{order.customer_phone || "Sin teléfono registrado"} · {order.order_type === "delivery" ? "A domicilio" : "Recoger en local"}</small></div><div className="ops-cash-payment"><span>{payment ? "Pago registrado" : "Método elegido"}</span><strong>{payment ? (payment.method === "cash" ? "💵 Efectivo pagado" : "🏦 Transferencia verificada") : (order.payment_method === "cash" ? "💵 Efectivo" : "🏦 Transferencia")}</strong>{payment && <small>{money(payment.amount)} · {new Date(payment.paid_at).toLocaleString("es-MX")}</small>}{payment?.method === "cash" && <small>Efectivo recibido: {money(payment.cash_tendered)} · <strong className="ops-change-confirmed">Cambio confirmado: {money(payment.change_due)}</strong></small>}{!payment && order.payment_method === "cash" && <small>Declaró pagar con {money(order.cash_amount)}</small>}</div><div className="ops-cash-total"><span>Total del pedido</span><strong>{money(order.total)}</strong></div>{!payment && order.status === "ready" && <div className="ops-payment-actions"><label>Método de pago real<select value={paymentMethodByOrder[order.id] ?? order.payment_method} onChange={e => setPaymentMethodByOrder(current => ({ ...current, [order.id]: e.target.value as Method }))}><option value="cash">💵 Efectivo</option><option value="transfer">🏦 Transferencia</option></select></label>{(paymentMethodByOrder[order.id] ?? order.payment_method) === "cash" ? <label>Efectivo recibido<input type="number" min={total} step="0.01" inputMode="decimal" value={cashTendered[order.id] ?? (order.cash_amount == null ? "" : String(order.cash_amount))} onChange={e => setCashTendered(current => ({ ...current, [order.id]: e.target.value }))} placeholder={money(total)} /></label> : <label>Referencia de transferencia<input type="text" maxLength={120} value={transferReference[order.id] ?? ""} onChange={e => setTransferReference(current => ({ ...current, [order.id]: e.target.value }))} placeholder="Folio o referencia bancaria" /></label>}{(paymentMethodByOrder[order.id] ?? order.payment_method) === "cash" && <div className="ops-change-preview" aria-live="polite"><span>Cambio para el cliente</span><strong>{(() => { const raw = cashTendered[order.id] ?? (order.cash_amount == null ? "" : String(order.cash_amount)); if (!raw.trim() || !Number.isFinite(Number(raw))) return "—"; const cents = Math.round((Number(raw) - total) * 100); return cents < 0 ? "Efectivo insuficiente" : money(cents / 100); })()}</strong><small>El importe definitivo lo valida Supabase al registrar el pago.</small></div>}<button className="ops-primary" disabled={busyId === order.id} onClick={() => void recordPayment(order)}>{busyId === order.id ? "Registrando…" : (paymentMethodByOrder[order.id] ?? order.payment_method) === "cash" ? "Registrar pago en efectivo" : "Confirmar transferencia recibida"}</button></div>}{!payment && order.status !== "ready" && order.status !== "delivered" && order.status !== "cancelled" && <small className="ops-paid-note">El pago se registra cuando cocina marca el pedido como listo.</small>}{payment && order.status === "ready" && <button className="ops-primary" disabled={busyId === order.id} onClick={() => void markDelivered(order)}>{busyId === order.id ? "Guardando…" : "Confirmar entrega"}</button>}{payment && <small className="ops-paid-note">Pago activo. No volver a cobrar.</small>}</article>; })}</div>}
      <aside className="ops-cash-warning"><strong>ℹ️ Reglas de cobro y entrega</strong><p>El pago se registra por el total del pedido. El efectivo recibido puede ser mayor y el cambio se calcula por separado. Una transferencia solo se registra después de verificar el abono en la cuenta bancaria. Entregar requiere un pago activo.</p></aside><p className="ops-footnote">Los datos se actualizan cada 15 segundos. El backend debe tener aplicadas las funciones y permisos del esquema canónico.</p>
    </section></main>;
}
