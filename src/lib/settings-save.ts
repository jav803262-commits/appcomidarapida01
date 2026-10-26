export type SaveResult = { error: { message: string } | null };

/**
 * Guarda la configuración pública y los datos bancarios (tabla privada) en el orden que exige la base.
 *
 * Dos triggers mantienen una regla: no se puede activar la transferencia sin cuenta, ni borrar la cuenta
 * mientras la transferencia está activa. Por eso el orden importa:
 *  - Al ACTIVAR (o mantener activa): primero la cuenta y después el interruptor.
 *  - Al DESACTIVAR: primero el interruptor y después los datos (que ya pueden quedar vacíos).
 * Si el primer guardado falla, no se intenta el segundo. Devuelve el error o null.
 */
export async function saveSettingsAndTransfer(params: {
  transferEnabled: boolean;
  saveSettings: () => PromiseLike<SaveResult>;
  saveTransfer: () => PromiseLike<SaveResult>;
}): Promise<{ message: string } | null> {
  const { transferEnabled, saveSettings, saveTransfer } = params;
  const first = transferEnabled ? await saveTransfer() : await saveSettings();
  if (first.error) return first.error;
  const second = transferEnabled ? await saveSettings() : await saveTransfer();
  return second.error;
}
