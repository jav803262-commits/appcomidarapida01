import { createClientId } from "@/lib/ids";

const STORAGE_KEY = "food-menu-pending-order-request";

type PendingRequest = { id: string; fingerprint: string };

function fingerprintPayload(payload: unknown): string {
  const input = JSON.stringify(payload);
  // Hash de 64 bits para comparar accidentalmente payloads iguales sin guardar PII.
  // No es una firma criptográfica ni se usa para autorizar operaciones.
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    a = Math.imul(a ^ code, 16777619) >>> 0;
    b = (Math.imul(b, 33) ^ code) >>> 0;
  }
  return `${input.length}-${a.toString(16)}-${b.toString(16)}`;
}

function readPendingRequest(): PendingRequest | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<PendingRequest>;
    return typeof parsed.id === "string" && typeof parsed.fingerprint === "string"
      ? { id: parsed.id, fingerprint: parsed.fingerprint }
      : null;
  } catch {
    return null;
  }
}

export function getOrderRequestId(
  payload: unknown,
  current?: PendingRequest | null,
): PendingRequest {
  const fingerprint = fingerprintPayload(payload);
  if (current?.fingerprint === fingerprint) return current;

  const saved = readPendingRequest();
  if (saved?.fingerprint === fingerprint) return saved;

  const next = { id: createClientId(), fingerprint };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // La idempotencia en memoria sigue funcionando aunque sessionStorage no esté disponible.
  }
  return next;
}

export function clearPendingOrderRequest() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // No bloquear el flujo de confirmación por un fallo de almacenamiento.
  }
}
