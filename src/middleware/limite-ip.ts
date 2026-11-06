import { NextFunction, Request, Response } from "express";

/**
 * Limite simples por IP em memória (janela fixa). Barra script em loop antes de chegar à IA.
 * Em memória: zera quando a instância reinicia; com 2 instâncias o limite efetivo pode dobrar.
 */
export function limitePorIp(maximo: number, janelaMs: number) {
  const contagens = new Map<string, { n: number; inicio: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const agora = Date.now();
    const ip = req.ip ?? "desconhecido";
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
