import { createClient } from "@supabase/supabase-js";
import { config } from "./env";

/** Cliente com service role: ignora RLS. Só para o backend. */
export const supabaseAdmin =
  config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

if (!supabaseAdmin) console.warn("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes: rotas protegidas vão responder 503.");
