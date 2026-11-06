import { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config/env";

export type Usuario = { id: string; email?: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: Usuario;
    }
  }
}

// Chaves públicas do Supabase Auth (assinatura assimétrica). O jose guarda em cache.
const jwks = config.SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

/** Exige "Authorization: Bearer <access_token do Supabase>". */
export async function exigirLogin(req: Request, res: Response, next: NextFunction) {
  if (!jwks) return res.status(503).json({ error: "Autenticação não configurada no servidor", code: "auth_off" });

  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: "Faça login para continuar", code: "unauthenticated" });

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${config.SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
    });
    if (!payload.sub) throw new Error("token sem sub");
    req.usuario = { id: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined };
    return next();
  } catch {
    return res.status(401).json({ error: "Sessão expirada. Entre de novo.", code: "unauthenticated" });
  }
}
