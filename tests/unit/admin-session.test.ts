import { describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

// El módulo importa el cliente de Supabase del navegador; aquí solo se prueba la función pura.
vi.mock("@/lib/supabase/browser", () => ({ supabaseBrowser: {} }));
import { classifyAdminSession } from "@/lib/admin-session";

const session = (user: Record<string, unknown>) => ({ user }) as unknown as Session;

describe("classifyAdminSession", () => {
  it("sin sesión → anonymous", () => {
    expect(classifyAdminSession(null)).toEqual({ status: "anonymous" });
  });

  it("rol admin en app_metadata → admin con su correo", () => {
    expect(classifyAdminSession(session({ email: "a@b.mx", app_metadata: { role: "admin" } })))
      .toEqual({ status: "admin", email: "a@b.mx" });
  });

  it("admin sin correo → texto genérico", () => {
    expect(classifyAdminSession(session({ app_metadata: { role: "admin" } })))
      .toEqual({ status: "admin", email: "Administrador" });
  });

  it("otro rol o sin metadata → forbidden", () => {
    expect(classifyAdminSession(session({ app_metadata: { role: "customer" } }))).toEqual({ status: "forbidden" });
    expect(classifyAdminSession(session({}))).toEqual({ status: "forbidden" });
  });

  it("el rol en user_metadata (editable por el usuario) NO cuenta", () => {
    expect(classifyAdminSession(session({ user_metadata: { role: "admin" }, app_metadata: {} })))
      .toEqual({ status: "forbidden" });
  });
});
