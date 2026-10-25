import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan las variables de entorno de Supabase");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function makeAdmin() {
  // Uso: npm run make-admin -- <uuid-del-usuario>
  const userId = process.argv[2];
  if (!userId || !UUID_RE.test(userId)) {
    throw new Error("Indica el UUID del usuario: npm run make-admin -- <uuid>");
  }

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