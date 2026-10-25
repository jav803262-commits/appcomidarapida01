"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Category = { id: number; name: string; slug: string; sort_order: number; active: boolean };
type Product = {
  id: number; category_id: number; name: string; description: string | null;
  price: number | string; image_url: string | null; emoji: string | null;
  available: boolean; sort_order: number;
};
type Extra = { id: number; product_id: number; name: string; price: number | string; available: boolean; sort_order: number };
type Settings = {
  id: number; business_name: string; description: string | null; phone: string | null;
  whatsapp: string | null; address: string | null; currency: string; ordering_enabled: boolean;
  delivery_enabled: boolean; delivery_fee: number | string; transfer_bank: string | null;
  transfer_holder: string | null; transfer_account: string | null;
  pickup_enabled: boolean; cash_enabled: boolean; transfer_enabled: boolean;
  min_order_amount: number | string; delivery_eta_minutes: number; pickup_eta_minutes: number;
  business_hours_enabled: boolean; business_timezone: string; delivery_neighborhoods: string[];
  schedule: Record<string, { enabled: boolean; open: string; close: string }>;
};

const emptyProduct = {
  category_id: "", name: "", description: "", price: "", image_url: "", emoji: "🍔",
  available: true, sort_order: 0,
};
const emptyExtra = { product_id: "", name: "", price: "0", available: true, sort_order: 0 };
const slugify = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdminMenuPage() {
  const [tab, setTab] = useState<"products" | "categories" | "extras" | "settings">("products");
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [clearCurrentImage, setClearCurrentImage] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [extraForm, setExtraForm] = useState(emptyExtra);
  const [editingExtraId, setEditingExtraId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const weekdays = [
    ["monday", "Lunes"], ["tuesday", "Martes"], ["wednesday", "Miércoles"],
    ["thursday", "Jueves"], ["friday", "Viernes"], ["saturday", "Sábado"], ["sunday", "Domingo"],
  ] as const;
  const defaultSchedule = Object.fromEntries(weekdays.map(([day]) => [day, { enabled: day !== "sunday", open: "10:00", close: "22:00" }])) as Record<string, { enabled: boolean; open: string; close: string }>;
  const currentSchedule = Object.fromEntries(weekdays.map(([day]) => [
    day, { ...defaultSchedule[day], ...(settings?.schedule?.[day] ?? {}) },
  ])) as Record<string, { enabled: boolean; open: string; close: string }>;

  const loadData = useCallback(async () => {
    const { data: sessionData } = await supabaseBrowser.auth.getSession();
    const session = sessionData.session;
    if (!session) { setIsAdmin(false); setChecking(false); return; }
    if (session.user.app_metadata?.role !== "admin") {
      setError("Esta cuenta no tiene el rol de administrador.");
      setIsAdmin(false); setChecking(false); return;
    }

    const [cat, prod, ext, cfg] = await Promise.all([
      supabaseBrowser.from("categories").select("*").order("sort_order"),
      supabaseBrowser.from("products").select("*").order("sort_order"),
      supabaseBrowser.from("product_extras").select("*").order("sort_order"),
      supabaseBrowser.from("settings").select("*").limit(1).maybeSingle(),
    ]);
    const firstError = cat.error || prod.error || ext.error || cfg.error;
    if (firstError) {
      setError(`No se pudo cargar el menú: ${firstError.message}`);
      setChecking(false); return;
    }
    setCategories((cat.data ?? []) as Category[]);
    setProducts((prod.data ?? []) as Product[]);
    setExtras((ext.data ?? []) as Extra[]);
    setSettings((cfg.data ?? null) as Settings | null);
    setIsAdmin(true);
    setError(""); setChecking(false);
  }, []);

  useEffect(() => {
    if (selectedImage) {
      const objectUrl = URL.createObjectURL(selectedImage);
      setImagePreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setImagePreview(clearCurrentImage ? null : (productForm.image_url.trim() || null));
    return undefined;
  }, [selectedImage, productForm.image_url, clearCurrentImage]);

  useEffect(() => {
    void loadData();
    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (session) window.setTimeout(() => void loadData(), 0);
      else { setIsAdmin(false); setChecking(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  function resetProduct() {
    setProductForm(emptyProduct);
    setEditingProductId(null);
    setSelectedImage(null);
    setClearCurrentImage(false);
  }

  function getManagedImagePath(url: string | null | undefined): string | null {
    if (!url) return null;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!projectUrl) return null;
    const prefix = `${projectUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/`;
    if (!url.startsWith(prefix)) return null;
    const path = url.slice(prefix.length);
    return path && !path.includes("..") ? path : null;
  }

  async function removeManagedImage(url: string | null | undefined) {
    const path = getManagedImagePath(url);
    if (!path) return;
    const { error: storageError } = await supabaseBrowser.storage.from("product-images").remove([path]);
    if (storageError) console.warn("No se pudo eliminar una imagen anterior de Storage:", storageError.message);
  }

  async function uploadProductImage(productId: number, file: File): Promise<{ url: string | null; error: string | null }> {
    const allowedTypes: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    };
    const extension = allowedTypes[file.type];
    if (!extension) return { url: null, error: "Formato no permitido. Usa JPG, PNG, WebP o AVIF." };
    if (file.size > 5 * 1024 * 1024) return { url: null, error: "La imagen supera el límite de 5 MB." };

    const safeName = slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 60) || "producto";
    const path = `products/${productId}/${Date.now()}-${safeName}.${extension}`;
    const { error: uploadError } = await supabaseBrowser.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) return { url: null, error: uploadError.message };

    const { data } = supabaseBrowser.storage.from("product-images").getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }
  function resetExtra() { setExtraForm(emptyExtra); setEditingExtraId(null); }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    const previousImageUrl = productForm.image_url.trim() || null;
    const payload = {
      category_id: Number(productForm.category_id),
      name: productForm.name.trim(),
      description: productForm.description.trim() || null,
      price: Number(productForm.price),
      image_url: clearCurrentImage ? null : previousImageUrl,
      emoji: productForm.emoji.trim() || "🍔",
      available: productForm.available,
      sort_order: Number(productForm.sort_order) || 0,
    };
    if (!payload.category_id || !payload.name || !Number.isFinite(payload.price) || payload.price < 0) {
      setError("Selecciona una categoría, escribe el nombre y usa un precio válido.");
      setSaving(false); return;
    }
    if (selectedImage && (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(selectedImage.type) || selectedImage.size > 5 * 1024 * 1024)) {
      setError("La imagen debe ser JPG, PNG, WebP o AVIF y pesar como máximo 5 MB.");
      setSaving(false); return;
    }

    const saveResult = editingProductId
      ? await supabaseBrowser.from("products").update(payload).eq("id", editingProductId).select("id").single()
      : await supabaseBrowser.from("products").insert(payload).select("id").single();
    if (saveResult.error || !saveResult.data) {
      setSaving(false);
      setError(`No se pudo guardar el producto: ${saveResult.error?.message ?? "No se recibió el identificador del producto."}`);
      return;
    }

    const savedProductId = Number(saveResult.data.id);
    let finalImageUrl = payload.image_url;
    if (selectedImage) {
      const uploadResult = await uploadProductImage(savedProductId, selectedImage);
      if (uploadResult.error || !uploadResult.url) {
        setSaving(false);
        setEditingProductId(savedProductId);
        setError(`El producto se guardó, pero no se pudo subir la imagen. ${uploadResult.error ?? "Intenta de nuevo."} Revisa que exista el bucket product-images y sus políticas de Storage.`);
        await loadData();
        return;
      }
      finalImageUrl = uploadResult.url;
      const { error: imageSaveError } = await supabaseBrowser.from("products")
        .update({ image_url: finalImageUrl }).eq("id", savedProductId);
      if (imageSaveError) {
        await removeManagedImage(finalImageUrl);
        setSaving(false);
        setEditingProductId(savedProductId);
        setError(`El archivo se subió, pero no se pudo guardar su URL: ${imageSaveError.message}`);
        await loadData();
        return;
      }
      if (previousImageUrl && previousImageUrl !== finalImageUrl) await removeManagedImage(previousImageUrl);
    } else if (clearCurrentImage && previousImageUrl) {
      await removeManagedImage(previousImageUrl);
    }

    setSaving(false);
    setMessage(editingProductId ? "Producto actualizado." : "Producto creado.");
    resetProduct(); await loadData();
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    setMessage(""); setError("");
    const { error: deleteError } = await supabaseBrowser.from("products").delete().eq("id", product.id);
    if (deleteError) {
      setError(deleteError.code === "23503"
        ? "No se puede eliminar: el producto está vinculado a un pedido o referencia histórica. Márcalo como no disponible."
        : `No se pudo eliminar: ${deleteError.message}`);
      return;
    }
    await removeManagedImage(product.image_url);
    setMessage("Producto eliminado."); await loadData();
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    const name = categoryName.trim();
    if (!name) { setError("Escribe el nombre de la categoría."); setSaving(false); return; }
    const payload = editingCategoryId
      ? { name, slug: slugify(name) }
      : { name, slug: slugify(name), sort_order: categories.length + 1, active: true };
    const query = editingCategoryId
      ? supabaseBrowser.from("categories").update(payload).eq("id", editingCategoryId)
      : supabaseBrowser.from("categories").insert(payload);
    const { error: saveError } = await query;
    setSaving(false);
    if (saveError) { setError(`No se pudo guardar la categoría: ${saveError.message}`); return; }
    setMessage(editingCategoryId ? "Categoría actualizada." : "Categoría creada.");
    setCategoryName(""); setEditingCategoryId(null); await loadData();
  }

  async function toggleCategory(category: Category) {
    const { error: updateError } = await supabaseBrowser.from("categories")
      .update({ active: !category.active }).eq("id", category.id);
    if (updateError) { setError(`No se pudo cambiar la categoría: ${updateError.message}`); return; }
    await loadData();
  }

  async function saveExtra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    const payload = {
      product_id: Number(extraForm.product_id),
      name: extraForm.name.trim(),
      price: Number(extraForm.price),
      available: extraForm.available,
      sort_order: Number(extraForm.sort_order) || 0,
    };
    if (!payload.product_id || !payload.name || !Number.isFinite(payload.price) || payload.price < 0) {
      setError("Selecciona un producto, escribe el nombre del extra y usa un precio válido.");
      setSaving(false); return;
    }
    const query = editingExtraId
      ? supabaseBrowser.from("product_extras").update(payload).eq("id", editingExtraId)
      : supabaseBrowser.from("product_extras").insert(payload);
    const { error: saveError } = await query;
    setSaving(false);
    if (saveError) { setError(`No se pudo guardar el extra: ${saveError.message}`); return; }
    setMessage(editingExtraId ? "Extra actualizado." : "Extra creado.");
    resetExtra(); await loadData();
  }

  async function deleteExtra(extra: Extra) {
    if (!window.confirm(`¿Eliminar el extra "${extra.name}"?`)) return;
    const { error: deleteError } = await supabaseBrowser.from("product_extras").delete().eq("id", extra.id);
    if (deleteError) { setError(`No se pudo eliminar el extra: ${deleteError.message}`); return; }
    setMessage("Extra eliminado."); await loadData();
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true); setMessage(""); setError("");
    const payload = {
      business_name: settings.business_name.trim(),
      description: settings.description?.trim() || null,
      phone: settings.phone?.trim() || null,
      whatsapp: settings.whatsapp?.trim() || null,
      address: settings.address?.trim() || null,
      ordering_enabled: settings.ordering_enabled,
      delivery_enabled: settings.delivery_enabled,
      delivery_fee: Number(settings.delivery_fee),
      delivery_neighborhoods: (settings.delivery_neighborhoods ?? []).map((item) => item.trim()).filter(Boolean).filter((item, index, list) => list.findIndex((value) => value.toLocaleLowerCase("es-MX") === item.toLocaleLowerCase("es-MX")) === index),
      transfer_bank: settings.transfer_bank?.trim() || null,
      transfer_holder: settings.transfer_holder?.trim() || null,
      transfer_account: settings.transfer_account?.trim() || null,
      pickup_enabled: settings.pickup_enabled,
      cash_enabled: settings.cash_enabled,
      transfer_enabled: settings.transfer_enabled,
      min_order_amount: Number(settings.min_order_amount),
      delivery_eta_minutes: Number(settings.delivery_eta_minutes),
      pickup_eta_minutes: Number(settings.pickup_eta_minutes),
      business_hours_enabled: settings.business_hours_enabled,
      business_timezone: settings.business_timezone?.trim() || "America/Mexico_City",
      schedule: currentSchedule,
    };
    if (!payload.business_name || !Number.isFinite(payload.delivery_fee) || payload.delivery_fee < 0 ||
        !Number.isFinite(payload.min_order_amount) || payload.min_order_amount < 0 ||
        !Number.isInteger(payload.delivery_eta_minutes) || payload.delivery_eta_minutes < 1 || payload.delivery_eta_minutes > 240 ||
        !Number.isInteger(payload.pickup_eta_minutes) || payload.pickup_eta_minutes < 1 || payload.pickup_eta_minutes > 240) {
      setError("Revisa el nombre, las tarifas, el mínimo de compra y los tiempos estimados.");
      setSaving(false); return;
    }
    const { error: saveError } = await supabaseBrowser.from("settings").update(payload).eq("id", settings.id);
    setSaving(false);
    if (saveError) { setError(`No se pudo guardar la configuración: ${saveError.message}`); return; }
    setMessage("Configuración del negocio actualizada."); await loadData();
  }

  if (checking) return <main className="admin-shell"><div className="admin-loading">Comprobando sesión…</div></main>;
  if (!isAdmin) return (
    <main className="admin-shell admin-login-wrap">
      <section className="admin-login">
        <a className="admin-back" href="/admin">← Volver al panel de pedidos</a>
        <div className="admin-brand-mark">TB</div><p className="admin-eyebrow">TORITOS BURGER</p>
        <h1>Administrar menú</h1>
        <p className="admin-muted">Inicia sesión con una cuenta administradora.</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <a className="admin-primary admin-login-link" href="/admin">Ir al inicio de sesión</a>
      </section>
    </main>
  );

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <a className="admin-topbrand" href="/admin">
          <span className="admin-brand-mark small">TB</span>
          <span><strong>Toritos Burger</strong><small>Administración del menú</small></span>
        </a>
        <div className="admin-account">
          <a className="admin-quiet-button" href="/admin">Pedidos</a>
          <button className="admin-quiet-button" onClick={async () => { await supabaseBrowser.auth.signOut(); window.location.href = "/admin"; }}>Cerrar sesión</button>
        </div>
      </header>
      <section className="admin-content">
        <div className="admin-heading-row">
          <div><p className="admin-eyebrow">CONFIGURACIÓN</p><h1>Menú y negocio</h1><p className="admin-muted">Los cambios se guardan directamente en Supabase.</p></div>
          <button className="admin-secondary" onClick={() => { setChecking(true); void loadData(); }}>↻ Actualizar</button>
        </div>
        {message && <p className="admin-notice" role="status">{message}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        <nav className="admin-tabs" aria-label="Secciones de administración">
          {([["products","Productos"],["categories","Categorías"],["extras","Extras"],["settings","Negocio"]] as const).map(([value,label]) =>
            <button key={value} className={`admin-tab ${tab === value ? "active" : ""}`} onClick={() => setTab(value)}>{label}</button>
          )}
        </nav>

        {tab === "products" && <div className="admin-manage-layout">
          <section className="admin-manage-card">
            <h2>{editingProductId ? "Editar producto" : "Nuevo producto"}</h2>
            <form className="admin-manage-form" onSubmit={saveProduct}>
              <label>Nombre<input className="field" value={productForm.name} onChange={e => setProductForm({...productForm,name:e.target.value})} required maxLength={100}/></label>
              <label>Categoría<select className="field" value={productForm.category_id} onChange={e => setProductForm({...productForm,category_id:e.target.value})} required><option value="">Selecciona</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Precio (MXN)<input className="field" type="number" min="0" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm,price:e.target.value})} required/></label>
              <label>Descripción<textarea className="field" rows={2} value={productForm.description} onChange={e => setProductForm({...productForm,description:e.target.value})}/></label>
              <div className="admin-image-field">
                <span className="admin-image-label">Fotografía del producto</span>
                <div className="admin-image-preview" aria-live="polite">
                  {imagePreview ? <img src={imagePreview} alt="Vista previa del producto" /> : <span aria-hidden="true">{productForm.emoji || "🍔"}</span>}
                </div>
                <label>Seleccionar imagen<input className="field" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => { const file = e.target.files?.[0] ?? null; setSelectedImage(file); if (file) setClearCurrentImage(false); }}/></label>
                <small className="admin-muted">JPG, PNG, WebP o AVIF. Máximo 5 MB. La imagen se sube al guardar el producto.</small>
                {(productForm.image_url || selectedImage) && <div className="admin-image-actions">
                  {selectedImage && <button type="button" className="admin-secondary" onClick={() => setSelectedImage(null)}>Cancelar nueva imagen</button>}
                  {!clearCurrentImage && <button type="button" className="admin-danger" onClick={() => { setSelectedImage(null); setClearCurrentImage(true); }}>Quitar imagen</button>}
                  {clearCurrentImage && <button type="button" className="admin-secondary" onClick={() => setClearCurrentImage(false)}>Deshacer</button>}
                </div>}
              </div>
              <label>Emoji alternativo<input className="field" value={productForm.emoji} onChange={e => setProductForm({...productForm,emoji:e.target.value})} maxLength={12}/></label>
              <label>Orden<input className="field" type="number" value={productForm.sort_order} onChange={e => setProductForm({...productForm,sort_order:Number(e.target.value)})}/></label>
              <label className="admin-check"><input type="checkbox" checked={productForm.available} onChange={e => setProductForm({...productForm,available:e.target.checked})}/> Disponible en el menú</label>
              <div className="admin-form-actions"><button className="admin-primary" disabled={saving}>{saving ? "Guardando…" : editingProductId ? "Guardar cambios" : "Crear producto"}</button>{editingProductId && <button type="button" className="admin-secondary" onClick={resetProduct}>Cancelar</button>}</div>
            </form>
          </section>
          <section className="admin-manage-list">
            <h2>Productos ({products.length})</h2>
            {products.map(p => <article className="admin-manage-row" key={p.id}>
              {p.image_url ? <img className="admin-product-thumb" src={p.image_url} alt={`Imagen de ${p.name}`} loading="lazy" /> : <div className="admin-product-thumb admin-product-thumb-empty" aria-hidden="true">{p.emoji || "🍽️"}</div>}
              <div className="admin-manage-row-main"><strong>{p.name}</strong><small>{categories.find(c=>c.id===p.category_id)?.name ?? "Sin categoría"} · {Number(p.price).toLocaleString("es-MX",{style:"currency",currency:"MXN"})}</small><span className={`admin-availability ${p.available ? "available" : ""}`}>{p.available ? "Disponible" : "Oculto"}</span></div>
              <div className="admin-row-actions"><button className="admin-secondary" onClick={() => {setEditingProductId(p.id);setProductForm({category_id:String(p.category_id),name:p.name,description:p.description ?? "",price:String(p.price),image_url:p.image_url ?? "",emoji:p.emoji ?? "🍔",available:p.available,sort_order:p.sort_order});setSelectedImage(null);setClearCurrentImage(false);window.scrollTo({top:0,behavior:"smooth"});}}>Editar</button><button className="admin-danger" onClick={() => void deleteProduct(p)}>Eliminar</button></div>
            </article>)}
          </section>
        </div>}

        {tab === "categories" && <div className="admin-manage-layout">
          <section className="admin-manage-card"><h2>{editingCategoryId ? "Editar categoría" : "Nueva categoría"}</h2>
            <form className="admin-manage-form" onSubmit={saveCategory}>
              <label>Nombre<input className="field" value={categoryName} onChange={e=>setCategoryName(e.target.value)} required maxLength={70}/></label>
              <p className="admin-muted">El identificador URL se genera automáticamente a partir del nombre.</p>
              <div className="admin-form-actions"><button className="admin-primary" disabled={saving}>{editingCategoryId ? "Guardar cambios" : "Crear categoría"}</button>{editingCategoryId && <button type="button" className="admin-secondary" onClick={()=>{setEditingCategoryId(null);setCategoryName("");}}>Cancelar</button>}</div>
            </form>
          </section>
          <section className="admin-manage-list"><h2>Categorías ({categories.length})</h2>
            {categories.map(c=><article className="admin-manage-row" key={c.id}><div className="admin-manage-row-main"><strong>{c.name}</strong><small>/{c.slug} · {products.filter(p=>p.category_id===c.id).length} productos</small><span className={`admin-availability ${c.active ? "available" : ""}`}>{c.active ? "Activa" : "Oculta"}</span></div><div className="admin-row-actions"><button className="admin-secondary" onClick={()=>{setEditingCategoryId(c.id);setCategoryName(c.name);}}>Editar</button><button className="admin-secondary" onClick={()=>void toggleCategory(c)}>{c.active ? "Ocultar" : "Activar"}</button></div></article>)}
          </section>
        </div>}

        {tab === "extras" && <div className="admin-manage-layout">
          <section className="admin-manage-card"><h2>{editingExtraId ? "Editar extra" : "Nuevo extra"}</h2>
            <form className="admin-manage-form" onSubmit={saveExtra}>
              <label>Producto<select className="field" value={extraForm.product_id} onChange={e=>setExtraForm({...extraForm,product_id:e.target.value})} required><option value="">Selecciona</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label>Nombre<input className="field" value={extraForm.name} onChange={e=>setExtraForm({...extraForm,name:e.target.value})} required maxLength={80}/></label>
              <label>Precio adicional (MXN)<input className="field" type="number" min="0" step="0.01" value={extraForm.price} onChange={e=>setExtraForm({...extraForm,price:e.target.value})} required/></label>
              <label>Orden<input className="field" type="number" value={extraForm.sort_order} onChange={e=>setExtraForm({...extraForm,sort_order:Number(e.target.value)})}/></label>
              <label className="admin-check"><input type="checkbox" checked={extraForm.available} onChange={e=>setExtraForm({...extraForm,available:e.target.checked})}/> Disponible</label>
              <div className="admin-form-actions"><button className="admin-primary" disabled={saving}>{editingExtraId ? "Guardar cambios" : "Crear extra"}</button>{editingExtraId && <button type="button" className="admin-secondary" onClick={resetExtra}>Cancelar</button>}</div>
            </form>
          </section>
          <section className="admin-manage-list"><h2>Extras ({extras.length})</h2>
            {extras.map(x=><article className="admin-manage-row" key={x.id}><div className="admin-manage-row-main"><strong>{x.name}</strong><small>{products.find(p=>p.id===x.product_id)?.name ?? "Producto eliminado"} · {Number(x.price).toLocaleString("es-MX",{style:"currency",currency:"MXN"})}</small><span className={`admin-availability ${x.available ? "available" : ""}`}>{x.available ? "Disponible" : "Oculto"}</span></div><div className="admin-row-actions"><button className="admin-secondary" onClick={()=>{setEditingExtraId(x.id);setExtraForm({product_id:String(x.product_id),name:x.name,price:String(x.price),available:x.available,sort_order:x.sort_order});}}>Editar</button><button className="admin-danger" onClick={()=>void deleteExtra(x)}>Eliminar</button></div></article>)}
          </section>
        </div>}

        {tab === "settings" && settings && <section className="admin-manage-card admin-settings-card">
          <h2>Datos del negocio</h2><form className="admin-manage-form admin-settings-form" onSubmit={saveSettings}>
            <label>Nombre del negocio<input className="field" value={settings.business_name} onChange={e=>setSettings({...settings,business_name:e.target.value})} required/></label>
            <label>Descripción<textarea className="field" rows={2} value={settings.description ?? ""} onChange={e=>setSettings({...settings,description:e.target.value})}/></label>
            <label>Teléfono<input className="field" value={settings.phone ?? ""} onChange={e=>setSettings({...settings,phone:e.target.value})}/></label>
            <label>WhatsApp (código país + número, sin + ni espacios)<input className="field" value={settings.whatsapp ?? ""} onChange={e=>setSettings({...settings,whatsapp:e.target.value.replace(/\D/g,"")})} inputMode="numeric"/></label>
            <label>Dirección<input className="field" value={settings.address ?? ""} onChange={e=>setSettings({...settings,address:e.target.value})}/></label>
            <h3 className="admin-settings-section-title">Pedidos y entregas</h3>
            <label>Colonias con cobertura de entrega (una por línea)<textarea className="field" rows={5} value={(settings.delivery_neighborhoods ?? []).join("\n")} onChange={e=>setSettings({...settings,delivery_neighborhoods:e.target.value.split("\n").map(item=>item.trim()).filter(Boolean)})} placeholder={"Centro\nBenito Juárez\nReforma"}/></label>
            <p className="admin-muted">Estas colonias aparecerán como opciones en el formulario. Si no configuras ninguna, los pedidos a domicilio quedarán deshabilitados.</p>
            <label>Tarifa de envío (MXN)<input className="field" type="number" min="0" step="0.01" value={String(settings.delivery_fee)} onChange={e=>setSettings({...settings,delivery_fee:e.target.value})} required/></label>
            <label>Pedido mínimo (MXN)<input className="field" type="number" min="0" step="0.01" value={String(settings.min_order_amount ?? 0)} onChange={e=>setSettings({...settings,min_order_amount:e.target.value})} required/></label>
            <label>Tiempo estimado a domicilio (minutos)<input className="field" type="number" min="1" max="240" step="1" value={String(settings.delivery_eta_minutes ?? 45)} onChange={e=>setSettings({...settings,delivery_eta_minutes:Number(e.target.value)})} required/></label>
            <label>Tiempo estimado para recoger (minutos)<input className="field" type="number" min="1" max="240" step="1" value={String(settings.pickup_eta_minutes ?? 20)} onChange={e=>setSettings({...settings,pickup_eta_minutes:Number(e.target.value)})} required/></label>
            <label className="admin-check"><input type="checkbox" checked={settings.ordering_enabled} onChange={e=>setSettings({...settings,ordering_enabled:e.target.checked})}/> Aceptar pedidos</label>
            <label className="admin-check"><input type="checkbox" checked={settings.delivery_enabled} onChange={e=>setSettings({...settings,delivery_enabled:e.target.checked})}/> Ofrecer envío a domicilio</label>
            <label className="admin-check"><input type="checkbox" checked={settings.pickup_enabled ?? true} onChange={e=>setSettings({...settings,pickup_enabled:e.target.checked})}/> Permitir recoger en el local</label>

            <h3 className="admin-settings-section-title">Métodos de pago</h3>
            <label className="admin-check"><input type="checkbox" checked={settings.cash_enabled ?? true} onChange={e=>setSettings({...settings,cash_enabled:e.target.checked})}/> Aceptar efectivo</label>
            <label className="admin-check"><input type="checkbox" checked={settings.transfer_enabled ?? true} onChange={e=>setSettings({...settings,transfer_enabled:e.target.checked})}/> Aceptar transferencia</label>
            <label>Banco para transferencia<input className="field" value={settings.transfer_bank ?? ""} onChange={e=>setSettings({...settings,transfer_bank:e.target.value})}/></label>
            <label>Titular de la cuenta<input className="field" value={settings.transfer_holder ?? ""} onChange={e=>setSettings({...settings,transfer_holder:e.target.value})}/></label>
            <label>Cuenta o CLABE<input className="field" value={settings.transfer_account ?? ""} onChange={e=>setSettings({...settings,transfer_account:e.target.value})}/></label>

            <h3 className="admin-settings-section-title">Horario del negocio</h3>
            <label className="admin-check"><input type="checkbox" checked={settings.business_hours_enabled ?? false} onChange={e=>setSettings({...settings,business_hours_enabled:e.target.checked,schedule:currentSchedule})}/> Restringir pedidos al horario configurado</label>
            <label>Zona horaria (identificador IANA)<input className="field" value={settings.business_timezone ?? "America/Mexico_City"} onChange={e=>setSettings({...settings,business_timezone:e.target.value})} placeholder="America/Mexico_City" required/></label>
            <p className="admin-muted">Si desactivas la restricción horaria, el negocio aceptará pedidos según el interruptor general. Horarios iguales o que cruzan medianoche no están permitidos; configura cada día dentro del mismo día.</p>
            <div className="admin-schedule-list">
              {weekdays.map(([day, label]) => {
                const daySchedule = currentSchedule[day];
                return <div className="admin-schedule-row" key={day}>
                  <label className="admin-check"><input type="checkbox" checked={daySchedule.enabled} onChange={e=>setSettings({...settings,schedule:{...(settings.schedule ?? defaultSchedule),[day]:{...daySchedule,enabled:e.target.checked}}})}/>{label}</label>
                  <label>Abre<input className="field" type="time" value={daySchedule.open} onChange={e=>setSettings({...settings,schedule:{...(settings.schedule ?? defaultSchedule),[day]:{...daySchedule,open:e.target.value}}})}/></label>
                  <label>Cierra<input className="field" type="time" value={daySchedule.close} onChange={e=>setSettings({...settings,schedule:{...(settings.schedule ?? defaultSchedule),[day]:{...daySchedule,close:e.target.value}}})}/></label>
                </div>;
              })}
            </div>
            <button className="admin-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</button>
          </form>
        </section>}
      </section>
    </main>
  );
}
