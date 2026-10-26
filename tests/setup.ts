import { afterEach } from "vitest";

// Solo se activa en pruebas de componentes (entorno jsdom).
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());
}
