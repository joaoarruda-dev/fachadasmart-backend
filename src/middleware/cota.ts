import { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase";

export type TipoGeracao = "previa" | "limpeza";

const MENSAGENS: Record<string, { status: number; error: string }> = {
  pending: { status: 403, error: "Sua conta aguarda liberação." },
  blocked: { status: 403, error: "Sua conta está bloqueada. Fale com o suporte." },
};

/**
 * Reserva 1 crédito antes de chamar a IA. Quando a resposta termina:
 * 2xx → a geração conta e guarda a URL da imagem (res.locals.imageUrl); qualquer erro → a reserva é devolvida.
 */
export function consumirCota(tipo: TipoGeracao) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!supabaseAdmin) return res.status(503).json({ error: "Controle de cota não configurado", code: "auth_off" });
    if (!req.usuario) return res.status(401).json({ error: "Faça login para continuar", code: "unauthenticated" });

    const { data, error } = await supabaseAdmin.rpc("reserve_generation", { p_user: req.usuario.id, p_kind: tipo });
    if (error) {
      console.error("reserve_generation", error);
      return res.status(500).json({ error: "Erro ao verificar a cota" });
    }

    if (!data?.ok) {
      if (data?.code === "quota") {
        const nome = tipo === "previa" ? "prévias" : "limpezas";
        return res.status(429).json({
          error: `Você usou as ${data.quota} ${nome} deste mês.`,
          code: "quota",
          used: data.used,
          quota: data.quota,
        });
      }
      const m = MENSAGENS[data?.code] ?? MENSAGENS.pending;
      return res.status(m.status).json({ error: m.error, code: data?.code ?? "pending" });
    }

    const id: number = data.id;
    res.on("finish", () => {
      const status = res.statusCode < 400 ? "done" : "failed";
      const imagem = status === "done" && typeof res.locals.imageUrl === "string" ? res.locals.imageUrl : null;
      supabaseAdmin!
        .rpc("finish_generation", { p_id: id, p_status: status, p_image_url: imagem })
        .then(({ error: e }) => e && console.error("finish_generation", e));
    });
    // Conexão caiu antes de responder: devolve a reserva
    res.on("close", () => {
      if (!res.writableFinished) supabaseAdmin!.rpc("finish_generation", { p_id: id, p_status: "failed" }).then(() => {});
    });

    return next();
  };
}

/** GET /api/me — status da conta e saldo do mês, para o front. */
export async function minhaConta(req: Request, res: Response) {
  if (!supabaseAdmin || !req.usuario) return res.status(503).json({ error: "Autenticação não configurada" });

  const [{ data: perfil, error: e1 }, { data: uso, error: e2 }] = await Promise.all([
    supabaseAdmin.from("profiles").select("email, company, status, quota_previas, quota_limpezas").eq("id", req.usuario.id).maybeSingle(),
    supabaseAdmin.rpc("usage_this_month", { p_user: req.usuario.id }),
  ]);
  if (e1 || e2) {
    console.error("me", e1 ?? e2);
    return res.status(500).json({ error: "Erro ao carregar a conta" });
  }

  const usado = (k: string) => Number((uso ?? []).find((u: any) => u.kind === k)?.used ?? 0);
  return res.json({
    email: perfil?.email ?? req.usuario.email,
    company: perfil?.company ?? null,
    status: perfil?.status ?? "pending",
    previas: { used: usado("previa"), quota: perfil?.quota_previas ?? 0 },
    limpezas: { used: usado("limpeza"), quota: perfil?.quota_limpezas ?? 0 },
  });
}
