import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type AdminSession =
  | { status: "anonymous" }
  | { status: "forbidden" }
  | { status: "admin"; email: string };

/**
 * Clasifica una sesión de Supabase Auth. Es la ÚNICA definición de "administrador" en la interfaz.
 *
 * Importante: esto solo mejora la experiencia (mostrar el panel o un aviso). La barrera de seguridad
 * real son las políticas RLS y las funciones SQL (is_admin()), que comprueban el rol en el servidor.
 * El rol vive en app_metadata, que el usuario no puede modificar (a diferencia de user_metadata).
 */
export function classifyAdminSession(session: Session | null): AdminSession {
  if (!session) return { status: "anonymous" };
  if (session.user.app_metadata?.role !== "admin") return { status: "forbidden" };
  return { status: "admin", email: session.user.email ?? "Administrador" };
}

export async function getAdminSession(): Promise<AdminSession> {
  const { data } = await supabaseBrowser.auth.getSession();
  return classifyAdminSession(data.session);
}
