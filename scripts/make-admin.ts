import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Diagnóstico de variables:", {
  supabaseUrl: supabaseUrl ? "Configurada" : "Faltante",
  serviceRoleKey: serviceRoleKey ? "Configurada" : "Faltante",
});

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan las variables de entorno de Supabase");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
async function makeAdmin() {
  const userId = "5b7224ef-cb35-4b46-8f69-c34a33390481";

  const { data: existing, error: lookupError } =
    await supabase.auth.admin.getUserById(userId);

  if (lookupError) throw lookupError;
  if (!existing.user) throw new Error("Usuario no encontrado");

  const { data, error } =
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...existing.user.app_metadata,
        role: "admin",
      },
    });

  if (error) throw error;

  console.log("Metadatos actualizados:", data.user.app_metadata);
}

makeAdmin().catch(console.error);