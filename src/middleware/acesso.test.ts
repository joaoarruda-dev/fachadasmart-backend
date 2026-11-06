import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

/**
 * Testa login + liberação + cota com um "Supabase" falso local:
 * serve o JWKS (para validar o token) e as RPCs usadas pelo backend.
 */

type Perfil = { status: string; quota_previas: number; quota_limpezas: number };
const perfis: Record<string, Perfil> = {
  ativo: { status: "active", quota_previas: 2, quota_limpezas: 2 },
  pendente: { status: "pending", quota_previas: 50, quota_limpezas: 50 },
};
let geracoes: { id: number; user: string; kind: string; status: string; image_url?: string | null }[] = [];

let supabaseFake: http.Server;
let api: http.Server;
let apiUrl = "";
let assinar: (sub: string) => Promise<string>;

function lerCorpo(req: http.IncomingMessage): Promise<any> {
  return new Promise((ok) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => ok(b ? JSON.parse(b) : {}));
  });
}

before(async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "teste", alg: "ES256", use: "sig" };

  supabaseFake = http.createServer(async (req, res) => {
    const json = (s: number, d: unknown) => {
      res.writeHead(s, { "Content-Type": "application/json" });
      res.end(JSON.stringify(d));
    };
    if (req.url?.startsWith("/auth/v1/.well-known/jwks.json")) return json(200, { keys: [jwk] });
    const body = await lerCorpo(req);
    if (req.url?.startsWith("/rest/v1/rpc/reserve_generation")) {
      const p = perfis[body.p_user];
      if (!p) return json(200, { ok: false, code: "pending" });
      if (p.status !== "active") return json(200, { ok: false, code: p.status });
      const quota = body.p_kind === "previa" ? p.quota_previas : p.quota_limpezas;
      const used = geracoes.filter((g) => g.user === body.p_user && g.kind === body.p_kind && g.status !== "failed").length;
      if (used >= quota) return json(200, { ok: false, code: "quota", used, quota });
      const id = geracoes.length + 1;
      geracoes.push({ id, user: body.p_user, kind: body.p_kind, status: "reserved" });
      return json(200, { ok: true, id, used: used + 1, quota });
    }
    if (req.url?.startsWith("/rest/v1/rpc/finish_generation")) {
      const g = geracoes.find((x) => x.id === body.p_id && x.status === "reserved");
      if (g) {
        g.status = body.p_status;
        g.image_url = body.p_image_url ?? g.image_url ?? null;
      }
      return json(200, null);
    }
    return json(404, {});
  });
  await new Promise<void>((ok) => supabaseFake.listen(0, ok));
  const supabaseUrl = `http://127.0.0.1:${(supabaseFake.address() as AddressInfo).port}`;

  process.env.SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-de-teste";
  assinar = (sub) =>
    new SignJWT({ email: `${sub}@teste.com`, role: "authenticated" })
      .setProtectedHeader({ alg: "ES256", kid: "teste" })
      .setSubject(sub)
      .setIssuer(`${supabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setExpirationTime("5m")
      .sign(privateKey);

  // Importa depois de definir as variáveis (config lê no import)
  const { app } = await import("../app");
  // Rota de teste: passa por login + cota e conclui com uma URL, sem chamar a IA
  const { exigirLogin } = await import("./auth");
  const { consumirCota } = await import("./cota");
  app.post("/teste/gerar", exigirLogin, consumirCota("previa"), (_req, res) => {
    res.locals.imageUrl = "https://previas.fachadasmart.com/fachada-logo/teste.jpg";
    res.json({ ok: true });
  });
  api = app.listen(0);
  await new Promise<void>((ok) => api.once("listening", ok));
  apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api`;
});

after(() => {
  api?.close();
  supabaseFake?.close();
});

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const ITENS = JSON.stringify({ itens: [{ materialId: "acm", largura_m: 5, altura_m: 1.2 }] });

test("sem token → 401", async () => {
  const r = await fetch(`${apiUrl}/orcamento`, { method: "POST", headers: { "Content-Type": "application/json" }, body: ITENS });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).code, "unauthenticated");
});

test("token falso → 401", async () => {
  const r = await fetch(`${apiUrl}/orcamento`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer abc.def.ghi" },
    body: ITENS,
  });
  assert.equal(r.status, 401);
});

test("logado: orçamento funciona e não consome cota", async () => {
  const r = await fetch(`${apiUrl}/orcamento`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await assinar("ativo")}` },
    body: ITENS,
  });
  assert.equal(r.status, 200);
  assert.equal(geracoes.length, 0);
});

test("conta pendente → 403 pending na prévia", async () => {
  const r = await fetch(`${apiUrl}/adicionar-logo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await assinar("pendente")}` },
  });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).code, "pending");
});

test("erro na geração devolve o crédito; cota esgota no limite", async () => {
  geracoes = [];
  const token = await assinar("ativo");
  // Sem fachada → 400 do controller → reserva vira "failed"
  const falha = await fetch(`${apiUrl}/adicionar-logo`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  assert.equal(falha.status, 400);
  await esperar(100);
  assert.equal(geracoes[0].status, "failed");

  // Simula 2 prévias concluídas (cota = 2)
  geracoes.push({ id: 90, user: "ativo", kind: "previa", status: "done" }, { id: 91, user: "ativo", kind: "previa", status: "done" });
  const r = await fetch(`${apiUrl}/adicionar-logo`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  assert.equal(r.status, 429);
  const corpo = await r.json();
  assert.equal(corpo.code, "quota");
  assert.equal(corpo.quota, 2);
});

test("geração concluída consome a cota e guarda a URL da imagem", async () => {
  geracoes = [];
  const r = await fetch(apiUrl.replace(/\/api$/, "/teste/gerar"), {
    method: "POST",
    headers: { Authorization: `Bearer ${await assinar("ativo")}` },
  });
  assert.equal(r.status, 200);
  await esperar(100);
  assert.equal(geracoes.length, 1);
  assert.equal(geracoes[0].status, "done");
  assert.equal(geracoes[0].image_url, "https://previas.fachadasmart.com/fachada-logo/teste.jpg");
});
