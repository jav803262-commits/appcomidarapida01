"use client";

import { useEffect, useState } from "react";
import { DEFAULT_BUSINESS_NAME } from "@/lib/business-name";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Nombre del negocio para las cabeceras de los paneles de administración (incluidas las pantallas de
 * inicio de sesión). `settings` es de lectura pública, así que no requiere sesión. Si la consulta falla,
 * se conserva el nombre por defecto.
 */
export function useBusinessName(): string {
  const [name, setName] = useState(DEFAULT_BUSINESS_NAME);

  useEffect(() => {
    let active = true;
    supabaseBrowser
      .from("settings")
      .select("business_name")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const value = typeof data?.business_name === "string" ? data.business_name.trim() : "";
        if (active && value) setName(value);
      });
    return () => { active = false; };
  }, []);

  return name;
}
