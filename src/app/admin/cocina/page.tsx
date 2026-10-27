"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getAdminSession } from "@/lib/admin-session";
import { useBusinessName } from "@/lib/use-business-name";
import { businessInitials } from "@/lib/business-name";

type Status = "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
type Item = { id: number; product_name: string; quantity: number; extras?: Array<{ name: string; price: number | string }> | null; subtotal: number | string };
type Order = { id: string; order_number: string; customer_name: string; order_type: "pickup" | "delivery"; notes: string | null; status: Status; created_at: string; order_items: Item[] };
const label: Record<Status, string> = { pending: "Pendiente", confirmed: "Confirmado", preparing: "Preparando", ready: "Listo", delivered: "Entregado", cancelled: "Cancelado" };
const elapsed = (date: string) => { const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000)); return minutes < 1 ? "Ahora" : `Hace ${minutes} min`; };

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const businessName = useBusinessName();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "preparing" | "ready">("pending");

  const load = useCallback(async () => {
    const admin = await getAdminSession();
    if (admin.status === "anonymous") { setEmail(""); setChecking(false); return; }
    if (admin.status === "forbidden") { setError("Tu cuenta no tiene permisos para acceder al panel operativo."); setChecking(false); return; }
    setEmail(admin.email);
    const { data, error: queryError } = await supabaseBrowser.from("orders").select("id,order_number,customer_name,order_type,notes,status,created_at,order_items(id,product_name,quantity,extras,subtotal)").in("status", ["pending", "confirmed", "preparing", "ready"]).order("created_at", { ascending: true }).limit(100);
    if (queryError) setError(`No se pudieron cargar los pedidos: ${queryError.message}`);
    else { setOrders((data ?? []) as Order[]); setError(""); }
    setChecking(false);
  }, []);

  useEffect(() => {
    void load();
    const { data: listener } = supabaseBrowser.auth.onAuthStateChange(() => { window.setTimeout(() => void load(), 0); });
    const poll = window.setInterval(() => void load(), 12000);
    return () => { listener.subscription.unsubscribe(); window.clearInterval(poll); };
  }, [load]);

  const shown = useMemo(() => orders.filter(o => tab === "pending" ? ["pending", "confirmed"].includes(o.status) : o.status === tab), [orders, tab]);
  async function advance(order: Order) {
    const next: Status = order.status === "pending" || order.status === "confirmed" ? "preparing" : "ready";
    setBusyId(order.id); setError("");
    const { error: updateError } = await supabaseBrowser.rpc("transition_order_status", {
      p_order_id: order.id,
      p_new_status: next,
    });
    if (updateError) {
      setError(`No se pudo cambiar el estado del pedido ${order.order_number}: ${updateError.message}`);
    } else {
      await load();
    }
    setBusyId(null);
  }

  if (checking) return <main className="ops-shell"><p>Comprobando sesión…</p></main>;
  if (!email) return <main className="ops-shell"><section className="ops-login"><a href="/admin">← Volver al panel</a><h1>Panel de cocina</h1><p>{error || "Inicia sesión con tu cuenta de administrador para acceder."}</p><a className="ops-primary" href="/admin">Ir a iniciar sesión</a></section></main>;
  const counts = { pending: orders.filter(o => ["pending", "confirmed"].includes(o.status)).length, preparing: orders.filter(o => o.status === "preparing").length, ready: orders.filter(o => o.status === "ready").length };
  return <main className="ops-shell ops-kitchen">
    <header className="ops-header"><a className="ops-brand" href="/admin"><span className="ops-logo">{businessInitials(businessName)}</span><span><strong>{businessName}</strong><small>Panel de cocina</small></span></a><nav className="ops-nav"><a className="active" href="/admin/cocina">🍳 Cocina</a><a href="/admin/caja">💳 Caja</a><a href="/admin">📋 Centro de pedidos</a></nav><div className="ops-user"><span>{email}</span><button onClick={() => void supabaseBrowser.auth.signOut()}>Salir</button></div></header>
    <section className="ops-content"><div className="ops-title-row"><div><p className="ops-eyebrow">OPERACIÓN EN TIEMPO REAL</p><h1>🍳 Cocina · Preparación de pedidos</h1><p>Prioriza los pedidos más antiguos. Abre cada tarjeta, revisa los productos y avanza su preparación. Actualización automática cada 12 segundos.</p></div><button className="ops-secondary" onClick={() => { setChecking(true); void load(); }}>↻ Actualizar pedidos</button></div>
      {error && <p className="ops-alert" role="alert">{error}</p>}
      <div className="ops-metrics"><button className={tab === "pending" ? "selected" : ""} onClick={() => setTab("pending")}><span>🧾</span><small>Pendientes</small><strong>{counts.pending}</strong></button><button className={tab === "preparing" ? "selected" : ""} onClick={() => setTab("preparing")}><span>🔥</span><small>Preparando</small><strong>{counts.preparing}</strong></button><button className={tab === "ready" ? "selected" : ""} onClick={() => setTab("ready")}><span>✅</span><small>Listos</small><strong>{counts.ready}</strong></button></div>
      {shown.length === 0 ? <section className="ops-empty"><span>🍔</span><h2>✅ Todo al día</h2><p>No hay pedidos en esta sección. Los nuevos aparecerán aquí automáticamente.</p></section> : <div className="ops-order-grid">{shown.map(order => <article className={`ops-order-card status-card-${order.status}`} key={order.id}><div className="ops-card-head"><div><span className="ops-folio">#{order.order_number}</span><span className="ops-age">{elapsed(order.created_at)}</span></div><span className={`ops-status status-${order.status}`}>{label[order.status]}</span></div><p className="ops-customer">{order.customer_name}</p><p className="ops-order-type">{order.order_type === "delivery" ? "🚚 Entrega a domicilio" : "🛍️ Recoger en local"}</p><div className="ops-products">{(order.order_items ?? []).map(item => <div className="ops-product" key={item.id}><strong><span>{item.quantity}×</span> {item.product_name}</strong>{Array.isArray(item.extras) && item.extras.length > 0 && <small>Extras: {item.extras.map(x => x.name).join(", ")}</small>}</div>)}</div>{order.notes && <div className="ops-notes"><strong>📝 Indicaciones especiales</strong><p>{order.notes}</p></div>}<button className="ops-primary" disabled={busyId === order.id || order.status === "ready"} onClick={() => void advance(order)}>{busyId === order.id ? "Guardando…" : order.status === "preparing" ? "✓ Marcar como listo" : order.status === "ready" ? "Pedido listo" : "🔥 Comenzar preparación"}</button></article>)}</div>}
      <p className="ops-footnote">Los cambios de estado se guardan en Supabase y se reflejan en el resto del sistema. Esta vista no registra pagos.</p>
    </section>
  </main>;
}
