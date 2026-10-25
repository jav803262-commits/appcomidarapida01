"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getAdminSession } from "@/lib/admin-session";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

type OrderItem = {
  id: number;
  product_name: string;
  unit_price: number | string;
  quantity: number;
  extras: Array<{ id?: number; name: string; price: number | string }>;
  subtotal: number | string;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  order_type: "pickup" | "delivery";
  payment_method: "cash" | "transfer";
  cash_amount: number | string | null;
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string;
  address: { street?: string; neighborhood?: string; reference?: string } | null;
  notes: string | null;
  status: OrderStatus;
  created_at: string;
  order_items: OrderItem[];
};

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmado" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
];

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [sessionEmail, setSessionEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [notificationOrderId, setNotificationOrderId] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState("received");
  const [notificationMessage, setNotificationMessage] = useState("");

  const signOut = useCallback(async () => {
    await supabaseBrowser.auth.signOut();
    setSessionEmail("");
    setOrders([]);
  }, []);

  const loadOrders = useCallback(async () => {
    const admin = await getAdminSession();

    if (admin.status === "anonymous") {
      setSessionEmail("");
      setChecking(false);
      return;
    }

    // La metadata solo sirve para mejorar la UX. RLS es la barrera de seguridad.
    if (admin.status === "forbidden") {
      setAuthError(
        "Esta cuenta no tiene el rol de administrador. Asigna app_metadata.role = admin en Supabase Auth."
      );
      setSessionEmail("");
      setChecking(false);
      return;
    }

    setSessionEmail(admin.email);
    const { data, error } = await supabaseBrowser
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setNotice(
        error.code === "42501"
          ? "Supabase rechazó el acceso. Revisa las políticas RLS y el rol del administrador."
          : `No se pudieron cargar los pedidos: ${error.message}`
      );
      setChecking(false);
      return;
    }

    setOrders((data ?? []) as OrderRow[]);
    setLastUpdated(new Date());
    setNotice("");
    setChecking(false);
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!active) return;

      if (data.session) {
        await loadOrders();
      } else {
        setChecking(false);
      }
    };

    void initialize();

    const { data: listener } = supabaseBrowser.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        if (session) {
          setChecking(true);
          // Defer Supabase queries until after the auth callback.
          window.setTimeout(() => {
            if (active) void loadOrders();
          }, 0);
        } else {
          setSessionEmail("");
          setOrders([]);
          setChecking(false);
        }
      }
    );

    const poll = window.setInterval(() => {
      void loadOrders();
    }, 15000);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.clearInterval(poll);
    };
  }, [loadOrders]);

  const filteredOrders = useMemo(
    () =>
      filter === "all" ? orders : orders.filter((order) => order.status === filter),
    [filter, orders]
  );

  const makeNotificationMessage = (order: OrderRow, type: string) => {
    const folio = `#${order.order_number}`;
    const total = money(order.total);
    switch (type) {
      case "ready":
        return `¡Hola, ${order.customer_name}! Tu pedido ${folio} está listo${order.order_type === "pickup" ? " para recoger en nuestro local" : ""}. Total: ${total}. ¡Gracias por elegir Toritos Burger!`;
      case "cancelled":
        return `Hola, ${order.customer_name}. Te informamos que tu pedido ${folio} fue cancelado. Si tienes dudas, por favor comunícate con Toritos Burger.`;
      case "delay":
        return `Hola, ${order.customer_name}. Tu pedido ${folio} está tardando un poco más de lo previsto. Te avisaremos en cuanto tengamos una actualización. Gracias por tu paciencia.`;
      case "question":
        return `Hola, ${order.customer_name}. Necesitamos aclarar un detalle de tu pedido ${folio}. ¿Podrías comunicarte con Toritos Burger, por favor?`;
      default:
        return `¡Hola, ${order.customer_name}! Recibimos tu pedido ${folio} por ${total}. Te avisaremos cuando esté listo. ¡Gracias por elegir Toritos Burger!`;
    }
  };

  const openNotification = (order: OrderRow, type: string) => {
    setNotificationOrderId(order.id);
    setNotificationType(type);
    setNotificationMessage(makeNotificationMessage(order, type));
  };

  const openWhatsApp = (order: OrderRow, message: string) => {
    const digits = (order.customer_phone ?? "").replace(/\D/g, "");
    const phone = digits.length === 10 ? `52${digits}` : digits;
    if (!phone || phone.length < 10) {
      setNotice(`El pedido ${order.order_number} no tiene un teléfono válido para WhatsApp.`);
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setNotice(`Se abrió WhatsApp con un mensaje preparado para ${order.order_number}. El sistema no puede confirmar desde aquí que se haya enviado.`);
  };

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setAuthError("");
    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setAuthError("No se pudo iniciar sesión. Verifica el correo y la contraseña.");
    }
  }

  async function updateStatus(order: OrderRow, status: OrderStatus) {
    setNotice("");
    const { error } = await supabaseBrowser.rpc("transition_order_status", {
      p_order_id: order.id,
      p_new_status: status,
    });

    if (error) {
      setNotice(
        error.code === "42501"
          ? "No tienes permiso para cambiar estados. Revisa el rol y los permisos de la función SQL."
          : `No se pudo cambiar el estado: ${error.message}`
      );
      return;
    }

    // La base de datos es la autoridad: recargamos el pedido en lugar de asumir el estado.
    await loadOrders();
    setNotice(`Cambio de estado confirmado para el pedido ${order.order_number}.`);
  }

  if (checking) {
    return (
      <main className="admin-shell">
        <div className="admin-loading">Comprobando sesión…</div>
      </main>
    );
  }

  if (!sessionEmail) {
    return (
      <main className="admin-shell admin-login-wrap">
        <section className="admin-login">
          <Link className="admin-back" href="/">← Volver al menú</Link>
          <div className="admin-brand-mark">TB</div>
          <p className="admin-eyebrow">TORITOS BURGER</p>
          <h1>Panel de pedidos</h1>
          <p className="admin-muted">Acceso exclusivo para el administrador del negocio.</p>
          <form className="admin-form" onSubmit={handleLogin}>
            <label>
              Correo electrónico
              <input
                className="field"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Contraseña
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {authError && <p className="admin-error" role="alert">{authError}</p>}
            <button className="admin-primary" type="submit" disabled={loading}>
              {loading ? "Ingresando…" : "Iniciar sesión"}
            </button>
          </form>
          <p className="admin-footnote">
            Las cuentas se crean en Supabase Auth. No existe registro público desde esta pantalla.
          </p>
        </section>
      </main>
    );
  }

  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const activeCount = orders.filter((order) =>
    ["confirmed", "preparing", "ready"].includes(order.status)
  ).length;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <a className="admin-topbrand" href="/admin">
          <span className="admin-brand-mark small">TB</span>
          <span><strong>Toritos Burger</strong><small>Panel administrativo</small></span>
        </a>
        <div className="admin-account">
          <nav className="admin-nav-links" aria-label="Áreas de trabajo">
            <a className="admin-quiet-button" href="/admin">📋 Pedidos</a>
            <a className="admin-quiet-button" href="/admin/cocina">🍳 Cocina</a>
            <a className="admin-quiet-button" href="/admin/caja">💳 Caja</a>
            <a className="admin-quiet-button" href="/admin/menu">🍔 Menú</a>
          </nav>
          <div className="admin-session-controls">
            <span className="admin-email">{sessionEmail}</span>
            <button className="admin-quiet-button" onClick={() => void signOut()}>Cerrar sesión</button>
          </div>
        </div>
      </header>

      <section className="admin-content">
        <div className="admin-heading-row">
          <div>
            <p className="admin-eyebrow">📍 CENTRO DE OPERACIÓN</p>
            <h1>📋 Centro de pedidos</h1>
            <p className="admin-muted">Supervisa los pedidos recibidos y su avance entre cocina y caja. {lastUpdated
                ? `Actualizado ${lastUpdated.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · actualización automática cada 15 segundos`
                : "Los pedidos guardados en Supabase aparecerán aquí."}
            </p>
          </div>
          <button className="admin-secondary" onClick={() => { setChecking(true); void loadOrders(); }}>
            ↻ Actualizar pedidos
          </button>
        </div>

        {notice && <p className="admin-notice" role="status">{notice}</p>}

        <div className="admin-stats">
          <article className="admin-stat"><span>📥 Pedidos recientes</span><strong>{orders.length}</strong><small>Últimos 100 pedidos</small></article>
          <article className="admin-stat"><span>🕒 Por confirmar</span><strong>{pendingCount}</strong><small>Requieren revisión</small></article>
          <article className="admin-stat"><span>🔥 En operación</span><strong>{activeCount}</strong><small>Confirmados, en cocina o listos</small></article>
        </div>

        <div className="admin-toolbar">
          <label className="admin-filter-label">
            🔎 Filtrar pedidos
            <select className="field admin-filter" value={filter} onChange={(event) => setFilter(event.target.value as "all" | OrderStatus)}>
              <option value="all">Todos los estados</option>
              {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </label>
          <span className="admin-muted">Mostrando {filteredOrders.length} de {orders.length} pedidos</span>
        </div>

        {filteredOrders.length === 0 ? (
          <section className="admin-empty">
            <span aria-hidden="true">📭</span>
            <h2>No hay pedidos en esta vista</h2>
            <p>Prueba otro filtro o espera a que llegue un pedido nuevo.</p>
          </section>
        ) : (
          <div className="admin-order-list">
            {filteredOrders.map((order) => (
              <article className="admin-order-card" key={order.id}>
                <button
                  className="admin-order-summary"
                  onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                  aria-expanded={selectedOrderId === order.id}
                >
                  <span className="admin-order-main">
                    <strong>#{order.order_number}</strong>
                    <span>{order.customer_name}</span>
                    <small>{dateTime(order.created_at)}</small>
                  </span>
                  <span className="admin-order-meta">
                    <strong>{money(order.total)}</strong>
                    <span className={`admin-status status-${order.status}`}>
                      {STATUSES.find((status) => status.value === order.status)?.label ?? order.status}
                    </span>
                    <span className="admin-expand">{selectedOrderId === order.id ? "−" : "+"}</span>
                  </span>
                </button>

                {selectedOrderId === order.id && (
                  <div className="admin-order-detail">
                    <div className="admin-detail-grid">
                      <div><small>🚚 Tipo de entrega</small><strong>{order.order_type === "delivery" ? "A domicilio" : "Recoger en local"}</strong></div>
                      <div><small>💰 Método elegido</small><strong>{order.payment_method === "cash" ? "Efectivo" : "Transferencia"}</strong></div>
                      {order.customer_phone && <div><small>Teléfono</small><strong>{order.customer_phone}</strong></div>}
                      {order.cash_amount != null && order.payment_method === "cash" && <div><small>Paga con</small><strong>{money(order.cash_amount)}</strong></div>}
                    </div>

                    {order.address && (
                      <div className="admin-detail-block">
                        <small>Dirección</small>
                        <p>{[order.address.street, order.address.neighborhood].filter(Boolean).join(", ")}</p>
                        {order.address.reference && <p className="admin-muted">Referencia: {order.address.reference}</p>}
                      </div>
                    )}

                    <div className="admin-detail-block">
                      <small>🛒 Detalle del pedido</small>
                      <div className="admin-items">
                        {(order.order_items ?? []).map((item) => (
                          <div className="admin-item" key={item.id}>
                            <div>
                              <strong>{item.quantity} × {item.product_name}</strong>
                              {Array.isArray(item.extras) && item.extras.length > 0 && (
                                <small>{item.extras.map((extra) => `${extra.name} (+${money(extra.price)})`).join(" · ")}</small>
                              )}
                            </div>
                            <span>{money(item.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.notes && <div className="admin-detail-block"><small>Notas</small><p>{order.notes}</p></div>}

                    <div className="admin-notification-actions">
                      <div>
                        <strong>💬 Comunicación con el cliente</strong>
                        <p className="admin-muted">Prepara un mensaje contextual para WhatsApp. Debes enviarlo desde WhatsApp.</p>
                      </div>
                      <div className="admin-notification-buttons">
                        <button type="button" className="admin-secondary" onClick={() => openNotification(order, "received")}>📥 Pedido recibido</button>
                        {order.status === "ready" && <button type="button" className="admin-secondary" onClick={() => openNotification(order, "ready")}>✅ Avisar que está listo</button>}
                        {order.status === "cancelled" && <button type="button" className="admin-secondary" onClick={() => openNotification(order, "cancelled")}>🚫 Avisar cancelación</button>}
                        <button type="button" className="admin-secondary" onClick={() => openNotification(order, "delay")}>🕒 Informar retraso</button>
                        <button type="button" className="admin-secondary" onClick={() => openNotification(order, "question")}>❓ Solicitar aclaración</button>
                      </div>
                    </div>

                    {notificationOrderId === order.id && (
                      <section className="admin-notification-composer" aria-label="Preparar mensaje de WhatsApp">
                        <div className="admin-notification-composer-heading">
                          <strong>Preparar mensaje · #{order.order_number}</strong>
                          <button type="button" className="admin-text-button" onClick={() => setNotificationOrderId(null)}>Cerrar</button>
                        </div>
                        <label className="admin-form-label">
                          Tipo de mensaje
                          <select className="field" value={notificationType} onChange={(event) => {
                            setNotificationType(event.target.value);
                            setNotificationMessage(makeNotificationMessage(order, event.target.value));
                          }}>
                            <option value="received">Pedido recibido</option>
                            <option value="ready">Pedido listo</option>
                            <option value="cancelled">Pedido cancelado</option>
                            <option value="delay">Retraso</option>
                            <option value="question">Solicitar aclaración</option>
                          </select>
                        </label>
                        <label className="admin-form-label">
                          Mensaje editable
                          <textarea className="field admin-message-textarea" value={notificationMessage} onChange={(event) => setNotificationMessage(event.target.value)} rows={4} maxLength={1000}/>
                        </label>
                        <p className="admin-muted">Teléfono del cliente: {order.customer_phone || "No registrado"}. Revisa el mensaje antes de enviarlo. Abrir WhatsApp no confirma el envío.</p>
                        <button type="button" className="admin-whatsapp-button" disabled={!order.customer_phone || !notificationMessage.trim()} onClick={() => openWhatsApp(order, notificationMessage)}>
                          <span aria-hidden="true">↗</span> Abrir WhatsApp con el mensaje
                        </button>
                      </section>
                    )}

                    <div className="admin-total-lines">
                      <div><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
                      <div><span>Envío</span><span>{money(order.delivery_fee)}</span></div>
                      <div className="admin-total"><strong>Total</strong><strong>{money(order.total)}</strong></div>
                    </div>

                    <label className="admin-status-control">
                      🔄 Estado del pedido
                      <select
                        className="field"
                        value={order.status}
                        onChange={(event) => void updateStatus(order, event.target.value as OrderStatus)}
                      >
                        {(order.status === "pending"
                          ? STATUSES.filter((s) => ["pending", "confirmed", "preparing", "cancelled"].includes(s.value))
                          : order.status === "confirmed"
                            ? STATUSES.filter((s) => ["confirmed", "preparing", "cancelled"].includes(s.value))
                            : order.status === "preparing"
                              ? STATUSES.filter((s) => ["preparing", "ready"].includes(s.value))
                              : order.status === "ready"
                                ? STATUSES.filter((s) => s.value === "ready")
                                : STATUSES.filter((s) => s.value === order.status)
                        ).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                      </select>
                      <small className="admin-muted">La entrega se confirma desde Caja después de registrar el pago.</small>
                    </label>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        <p className="admin-footnote admin-endnote">
          El centro de pedidos es para supervisión. Cocina gestiona la preparación y caja registra pagos y entregas. Se muestran hasta 100 pedidos recientes.
        </p>
      </section>
    </main>
  );
}
