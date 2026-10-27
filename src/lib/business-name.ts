/** Nombre que se muestra mientras se carga la configuración o si el negocio aún no definió uno. */
export const DEFAULT_BUSINESS_NAME = "Mi negocio";

/**
 * Iniciales para el logotipo de texto: primera letra de las dos primeras palabras
 * («Tacos El Güero» → «TE»); con una sola palabra, sus dos primeras letras («Pizzas» → «PI»).
 */
export function businessInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  const clean = (word: string) => Array.from(word).filter((char) => /[\p{L}\p{N}]/u.test(char));
  if (words.length === 0) return businessInitials(DEFAULT_BUSINESS_NAME);
  const letters = words.length >= 2 ? [clean(words[0])[0], clean(words[1])[0]] : clean(words[0]).slice(0, 2);
  return letters.join("").toLocaleUpperCase("es-MX");
}
