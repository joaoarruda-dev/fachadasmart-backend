import { Router } from "express";
import { orcamentoFachada, limparImagemFachada, adicionarLogoFachada } from "../controllers/fachada.controller";
import upload from "../utils/fileUpload";

export const fachadaRouter = Router();

fachadaRouter.post("/orcamento", orcamentoFachada);

fachadaRouter.post("/limpar-imagem", upload.single("image"), limparImagemFachada);

fachadaRouter.post(
  "/adicionar-logo",
  upload.fields([
    { name: "fachada", maxCount: 1 },
    { name: "referencia", maxCount: 1 },
  ]),
  adicionarLogoFachada
);
