import { timingSafeEqual } from "crypto";
import { NextFunction, Request, Response } from "express";
import { config } from "../config/env";

/**
 * IP do cliente. Atrás do proxy da Cloudflare, req.ip é o IP do Worker (igual para todos);
 * o IP real vem em x-client-ip, aceito só com o x-proxy-secret correto.
 */
export function ipDoCliente(req: Request): string {
  const segredo = req.get("x-proxy-secret");
  const ipProxy = req.get("x-client-ip");
  if (config.PROXY_SECRET && segredo && ipProxy) {
    const a = Buffer.from(segredo);
    const b = Buffer.from(config.PROXY_SECRET);
    if (a.length === b.length && timingSafeEqual(a, b)) return ipProxy;
  }
  return req.ip ?? "desconhecido";
}

/**
 * Limite simples por IP em memória (janela fixa). Barra script em loop antes de chegar à IA.
 * Em memória: zera quando a instância reinicia; com 2 instâncias o limite efetivo pode dobrar.
 */
export function limitePorIp(maximo: number, janelaMs: number) {
  const contagens = new Map<string, { n: number; inicio: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const agora = Date.now();
    const ip = ipDoCliente(req);
    const atual = contagens.get(ip);
    if (!atual || agora - atual.inicio > janelaMs) {
      contagens.set(ip, { n: 1, inicio: agora });
      if (contagens.size > 10_000) contagens.clear(); // evita crescer sem limite
      return next();
    }
    if (++atual.n > maximo) {
      res.setHeader("Retry-After", Math.ceil((atual.inicio + janelaMs - agora) / 1000));
      return res.status(429).json({ error: "Muitas requisições. Tente de novo em instantes.", code: "rate_limit" });
    }
    return next();
  };
}
