import dotenv from "dotenv";
dotenv.config();

export const config = {
  OPENAI_KEY: process.env.OPENAI_KEY || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5.6-sol",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "",
  // Segredo compartilhado com o proxy api.fachadasmart.com (Cloudflare Worker). Vazio = sem proxy.
  PROXY_SECRET: process.env.PROXY_SECRET || "",
  PORT: process.env.PORT || 8080,
  // Supabase: valida o login e controla liberação/cota. A service role key é SECRETA (só backend).
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  // Cloudflare R2 (imagens geradas). Sem estas variáveis, salva em /uploads local.
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
  R2_BUCKET: process.env.R2_BUCKET || "",
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || "",
};
