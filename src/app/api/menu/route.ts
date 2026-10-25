import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { CatalogData } from "@/types";

const dayKeys: Record<string, string> = {
  Monday: "monday", Tuesday: "tuesday", Wednesday: "wednesday", Thursday: "thursday",
  Friday: "friday", Saturday: "saturday", Sunday: "sunday",
};

function isBusinessOpen(settings: {
  business_hours_enabled?: boolean;
  business_timezone?: string | null;
  schedule?: Record<string, { enabled?: boolean; open?: string; close?: string }> | null;
}) {
  if (!settings.business_hours_enabled) return true;
  try {
    const timezone = settings.business_timezone || "America/Mexico_City";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    const day = settings.schedule?.[dayKeys[part("weekday")]];
    if (!day?.enabled || !day.open || !day.close || day.open >= day.close) return false;
    const current = `${part("hour")}:${part("minute")}`;
    return current >= day.open && current < day.close;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const [settingsResult, categoriesResult, productsResult, extrasResult] =
      await Promise.all([
        supabaseServer
          .from("settings")
          // Columnas explícitas: nunca select("*") sobre datos de negocio.
          .select("business_name,description,phone,whatsapp,address,currency,ordering_enabled,delivery_enabled,pickup_enabled,delivery_fee,min_order_amount,cash_enabled,transfer_enabled,delivery_eta_minutes,pickup_eta_minutes,business_hours_enabled,business_timezone,schedule,delivery_neighborhoods")
          .limit(1)
          .maybeSingle(),
        supabaseServer
          .from("categories")
          .select("id,name,slug,sort_order")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabaseServer
          .from("products")
          .select("id,category_id,name,description,price,image_url,emoji,available,sort_order")
          .eq("available", true)
          .order("sort_order", { ascending: true }),
        supabaseServer
          .from("product_extras")
          .select("id,product_id,name,price,available,sort_order")
          .eq("available", true)
          .order("sort_order", { ascending: true }),
      ]);

    const error =
      settingsResult.error ||
      categoriesResult.error ||
      productsResult.error ||
      extrasResult.error;

if (error) {
  console.error("[API /menu] Error de Supabase:", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  return NextResponse.json(
    {
      code: "MENU_ERROR",
      message: "No fue posible cargar el menú.",
    },
    { status: 500 },
  );
}


    if (!settingsResult.data) {
      return NextResponse.json(
        { code: "SETTINGS_NOT_FOUND", message: "No existe la configuración del negocio." },
        { status: 500 },
      );
    }

    const settings = settingsResult.data;
    const categoryMap = new Map(
      (categoriesResult.data ?? []).map((category) => [category.id, category]),
    );

    const extrasByProduct = new Map<number, NonNullable<typeof extrasResult.data>>();
    for (const extra of extrasResult.data ?? []) {
      const current = extrasByProduct.get(extra.product_id) ?? [];
      current.push(extra);
      extrasByProduct.set(extra.product_id, current);
    }

    const products = (productsResult.data ?? [])
      .filter((product) => categoryMap.has(product.category_id))
      .map((product) => ({
        id: String(product.id),
        name: product.name,
        description: product.description ?? "",
        price: Number(product.price),
        imageUrl: product.image_url ?? undefined,
        emoji: product.emoji ?? "🍔",
        category: categoryMap.get(product.category_id)!.slug,
        available: product.available,
        extras: (extrasByProduct.get(product.id) ?? []).map((extra) => ({
          id: String(extra.id),
          name: extra.name,
          price: Number(extra.price),
          available: extra.available,
        })),
      }));

    const catalog: CatalogData = {
      settings: {
        name: settings.business_name,
        description: settings.description ?? "",
        phone: settings.phone ?? "",
        whatsapp: settings.whatsapp ?? "",
        address: settings.address ?? "",
        currency: settings.currency ?? "MXN",
        orderingEnabled: settings.ordering_enabled && isBusinessOpen(settings),
        businessOpen: isBusinessOpen(settings),
        businessHoursEnabled: Boolean(settings.business_hours_enabled),
        schedule: settings.schedule ?? {},
        businessTimezone: settings.business_timezone ?? "America/Mexico_City",
        deliveryEnabled: settings.delivery_enabled,
        deliveryFee: Number(settings.delivery_fee ?? 0),
        minOrderAmount: Number(settings.min_order_amount ?? 0),
        deliveryEtaMinutes: Number(settings.delivery_eta_minutes ?? 45),
        pickupEtaMinutes: Number(settings.pickup_eta_minutes ?? 20),
        pickupEnabled: Boolean(settings.pickup_enabled ?? true),
        deliveryNeighborhoods: Array.isArray(settings.delivery_neighborhoods) ? settings.delivery_neighborhoods : [],
        paymentMethods: {
          cash: Boolean(settings.cash_enabled ?? true),
          // La base garantiza que transfer_enabled solo es true si hay cuenta configurada.
          // Los datos bancarios NO se publican aquí: llegan en la respuesta de /api/orders.
          transfer: Boolean(settings.transfer_enabled),
        },
      },
      categories: (categoriesResult.data ?? []).map((category) => ({
        id: String(category.id),
        name: category.name,
        slug: category.slug,
        sortOrder: category.sort_order,
      })),
      products,
    };

    return NextResponse.json(catalog, {
      headers: { "Cache-Control": "no-store" },
    });
  } 

  catch (error) {
  console.error("[API /menu] Error inesperado:", error);

  return NextResponse.json(
    {
      code: "MENU_ERROR",
      message: "No fue posible cargar el menú.",
    },
    { status: 500 },
  );
}
}
