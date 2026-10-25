import { afterEach, describe, expect, it, vi } from "vitest";
import { createClientId } from "@/lib/ids";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe("createClientId", () => {
  it("usa randomUUID cuando existe", () => {
    expect(createClientId()).toMatch(UUID_V4);
  });

  it("recurre a getRandomValues y produce un UUID v4 válido", () => {
    vi.stubGlobal("crypto", { getRandomValues: (b: Uint8Array) => { b.fill(255); return b; } });
    expect(createClientId()).toMatch(UUID_V4);
  });

  it("sin crypto usa Math.random y sigue siendo UUID v4 válido", () => {
    vi.stubGlobal("crypto", undefined);
    expect(createClientId()).toMatch(UUID_V4);
  });

  it("genera valores distintos", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createClientId()));
    expect(ids.size).toBe(200);
  });
});
