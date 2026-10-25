import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type CreateOrderBody = {
  clientRequestId?: string;
  customer?: {
    name?: string;
    phone?: string;
  };
  orderType?: "pickup" | "delivery";
  paymentMethod?: "cash" | "transfer";
  cashAmount?: number;
  items?: Array<{
    productId?: number | string;
    quantity?: number;
    extraIds?: Array<number | string>;
  }>;
  address?: {
    street?: string;
    neighborhood?: string;
    reference?: string;
  };
  notes?: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateOrderBody;

    if (typeof body.clientRequestId !== "string" || !isUuid(body.clientRequestId)) {
      return NextResponse.json(
        { code: "INVALID_REQUEST_ID", message: "clientRequestId no es válido." },
        { status: 400 }
      );
    }

    if (typeof body.customer?.name !== "string" || !body.customer.name.trim()) {
      return NextResponse.json(
        { code: "INVALID_CUSTOMER", message: "El nombre del cliente es obligatorio." },
        { status: 400 }
      );
    }

    const phoneDigits = body.customer?.phone?.replace(/\D/g, "") ?? "";
    if (phoneDigits.length !== 10) {
      return NextResponse.json(
        { code: "INVALID_PHONE", message: "El teléfono es obligatorio y debe contener 10 dígitos." },
        { status: 400 }
      );
    }

    if (!body.items?.length) {
      return NextResponse.json(
        { code: "EMPTY_CART", message: "El pedido no contiene productos." },
        { status: 400 }
      );
    }

    if (body.orderType === "delivery") {
      const { data: settings, error: settingsError } = await supabaseServer
        .from("settings").select("delivery_neighborhoods, delivery_enabled").limit(1).maybeSingle();
      if (settingsError || !settings) {
        return NextResponse.json({ code: "SETTINGS_ERROR", message: "No se pudo validar la zona de entrega." }, { status: 503 });
      }
      const allowedNeighborhoods = Array.isArray(settings.delivery_neighborhoods) ? settings.delivery_neighborhoods as string[] : [];
      if (!settings.delivery_enabled || allowedNeighborhoods.length === 0 || !body.address?.neighborhood ||
          !allowedNeighborhoods.some((item) => item.toLocaleLowerCase("es-MX") === body.address?.neighborhood?.trim().toLocaleLowerCase("es-MX"))) {
        return NextResponse.json({ code: "OUT_OF_COVERAGE", message: "No realizamos entregas en esa colonia. Selecciona una colonia disponible." }, { status: 400 });
      }
    }

    const { data, error } = await supabaseServer.rpc("create_order", {
      p_payload: {
        ...body,
        customer: {
          ...body.customer,
          name: body.customer.name.trim(),
          phone: phoneDigits,
        },
      },
    });

    if (error) {
      // PT429: límite anti-abuso de create_order (ver migración order_abuse_protection).
      const status =
        error.code === "P0001"
          ? 409
          : error.code === "PT429"
            ? 429
            : 500;

      return NextResponse.json(
        {
          code: error.code ?? "ORDER_ERROR",
          message: error.message ?? "No fue posible crear el pedido.",
        },
        { status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        code: "INVALID_JSON",
        message: "La solicitud no tiene un formato válido.",
      },
      { status: 400 }
    );
  }
}
