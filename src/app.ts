import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { fachadaRouter } from "./routes/fachada.routes";
import { config } from "./config/env";

export const app = express();

// Cloud Run: confia só no salto do Google (o último IP do X-Forwarded-For).
// "true" confiaria no cabeçalho inteiro, que o cliente pode forjar para escapar do limite por IP.
app.set("trust proxy", 1);

// Vazio = libera qualquer origem (dev local). Em produção defina CORS_ORIGIN.
app.use(cors({ origin: config.CORS_ORIGIN ? config.CORS_ORIGIN.split(",") : true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static("uploads"));
app.use("/api", fachadaRouter);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload inválido: ${err.code}${err.field ? ` (${err.field})` : ""}` });
  }
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Corpo da requisição muito grande" });
  if (err instanceof SyntaxError) return res.status(400).json({ error: "JSON inválido" });
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
});
