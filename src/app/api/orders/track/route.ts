import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Lightweight per-instance limit. On multi-instance deployments, use a shared
// limiter (e.g. Redis/managed rate limiting) for a distributed guarantee.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const attempts = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function allowAttempt(key: string) {
  const now = Date.now();
  for (const [candidate, value] of attempts) {
    if (value.resetAt <= now) attempts.delete(candidate);
  }
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  const key = getClientKey(request);
  if (!allowAttempt(key)) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "300" } },
    );
  }

  try {
    const body = (await request.json()) as { folio?: unknown; phoneLast4?: unknown };
    const folio = typeof body.folio === "string" ? body.folio.trim().toUpperCase() : "";
    const phoneLast4 = typeof body.phoneLast4 === "string" ? body.phoneLast4.replace(/\D/g, "") : "";
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(folio) || !/^\d{4}$/.test(phoneLast4)) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "No encontramos un pedido con esos datos. Revisa que el folio esté escrito correctamente." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data, error } = await supabaseServer.rpc("get_public_order_status", {
      p_order_number: folio,
      p_phone_last4: phoneLast4,
    });

    if (error) {
      console.error("[API /orders/track] Error de consulta:", { code: error.code, message: error.message });
      return NextResponse.json(
        { code: "TRACKING_UNAVAILABLE", message: "No fue posible consultar el pedido en este momento." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!data) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "No encontramos un pedido con esos datos. Revisa que el folio esté escrito correctamente." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "La solicitud no tiene un formato válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
