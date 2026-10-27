// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({
  supabaseBrowser: { from: () => ({ select: () => ({ limit: () => ({ maybeSingle }) }) }) },
}));
import { useBusinessName } from "@/lib/use-business-name";
import { DEFAULT_BUSINESS_NAME } from "@/lib/business-name";

beforeEach(() => maybeSingle.mockReset());

describe("useBusinessName", () => {
  it("empieza con el nombre por defecto y luego usa el configurado", async () => {
    maybeSingle.mockResolvedValue({ data: { business_name: "  Tacos El Güero " } });
    const { result } = renderHook(() => useBusinessName());
    expect(result.current).toBe(DEFAULT_BUSINESS_NAME);
    await waitFor(() => expect(result.current).toBe("Tacos El Güero"));
  });

  it("conserva el nombre por defecto si no hay configuración", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    const { result } = renderHook(() => useBusinessName());
    await waitFor(() => expect(maybeSingle).toHaveBeenCalled());
    expect(result.current).toBe(DEFAULT_BUSINESS_NAME);
  });

  it("ignora un nombre vacío", async () => {
    maybeSingle.mockResolvedValue({ data: { business_name: "   " } });
    const { result } = renderHook(() => useBusinessName());
    await waitFor(() => expect(maybeSingle).toHaveBeenCalled());
    expect(result.current).toBe(DEFAULT_BUSINESS_NAME);
  });
});
