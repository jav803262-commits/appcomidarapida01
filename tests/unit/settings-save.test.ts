import { describe, expect, it } from "vitest";
import { saveSettingsAndTransfer, type SaveResult } from "@/lib/settings-save";

function setup(results: { settings?: SaveResult; transfer?: SaveResult } = {}) {
  const calls: string[] = [];
  return {
    calls,
    saveSettings: async () => { calls.push("settings"); return results.settings ?? { error: null }; },
    saveTransfer: async () => { calls.push("transfer"); return results.transfer ?? { error: null }; },
  };
}

describe("saveSettingsAndTransfer (orden exigido por los triggers de la base)", () => {
  it("al activar la transferencia guarda primero la cuenta y luego el interruptor", async () => {
    const s = setup();
    expect(await saveSettingsAndTransfer({ transferEnabled: true, ...s })).toBeNull();
    expect(s.calls).toEqual(["transfer", "settings"]);
  });

  it("al desactivarla guarda primero el interruptor y luego los datos", async () => {
    const s = setup();
    expect(await saveSettingsAndTransfer({ transferEnabled: false, ...s })).toBeNull();
    expect(s.calls).toEqual(["settings", "transfer"]);
  });

  it("si falla el primer guardado, no intenta el segundo y devuelve el error", async () => {
    const s = setup({ transfer: { error: { message: "falló la cuenta" } } });
    expect(await saveSettingsAndTransfer({ transferEnabled: true, ...s })).toEqual({ message: "falló la cuenta" });
    expect(s.calls).toEqual(["transfer"]);
  });

  it("si falla el segundo guardado, devuelve su error", async () => {
    const s = setup({ settings: { error: { message: "falló la configuración" } } });
    expect(await saveSettingsAndTransfer({ transferEnabled: true, ...s })).toEqual({ message: "falló la configuración" });
    expect(s.calls).toEqual(["transfer", "settings"]);
  });
});
