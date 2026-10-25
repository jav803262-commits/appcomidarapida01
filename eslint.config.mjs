import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Regla nueva del compilador de React. El patrón "leer localStorage/sessionStorage dentro de un
      // efecto para hidratar el estado" es válido y evita errores de hidratación en SSR, y la carga de
      // datos en paneles admin también. Se mantiene como advertencia (deuda técnica documentada en
      // docs/calidad.md) hasta refactorizarlo con useSyncExternalStore / hooks de datos.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
]);
