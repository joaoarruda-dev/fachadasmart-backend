import { Router } from "express";
import { orcamentoFachada, limparImagemFachada, adicionarLogoFachada } from "../controllers/fachada.controller";
import upload from "../utils/fileUpload";
import { exigirLogin } from "../middleware/auth";
import { consumirCota, minhaConta } from "../middleware/cota";
import { limitePorIp } from "../middleware/limite-ip";

export const fachadaRouter = Router();

// Contra abuso antes de qualquer verificação: 60 req/min por IP na API inteira
fachadaRouter.use(limitePorIp(60, 60_000));

// Conta e saldo do mês
fachadaRouter.get("/me", exigirLogin, minhaConta);

// Orçamento: exige login, não consome cota
fachadaRouter.post("/orcamento", exigirLogin, orcamentoFachada);

// IA de imagem: login + cota do mês (falha devolve o crédito)
fachadaRouter.post("/limpar-imagem", exigirLogin, consumirCota("limpeza"), upload.single("image"), limparImagemFachada);

fachadaRouter.post(
  "/adicionar-logo",
  exigirLogin,
  consumirCota("previa"),
  upload.fields([
    { name: "fachada", maxCount: 1 },
    { name: "referencia", maxCount: 1 },
  ]),
  adicionarLogoFachada
);
