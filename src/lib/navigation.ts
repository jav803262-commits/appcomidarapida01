/** Navegación completa del navegador (también hacia sitios externos como wa.me). Aislada para poder probarla. */
export function navigateTo(url: string) {
  window.location.href = url;
}
