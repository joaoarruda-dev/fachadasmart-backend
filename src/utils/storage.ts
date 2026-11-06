import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config/env";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const EXTENSOES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** R2 ligado quando todas as variáveis existem; senão cai no disco local (dev). */
const r2Ativo = Boolean(
  config.R2_ACCOUNT_ID && config.R2_ACCESS_KEY_ID && config.R2_SECRET_ACCESS_KEY && config.R2_BUCKET && config.R2_PUBLIC_URL
);

const r2 = r2Ativo
  ? new S3Client({
      region: "auto",
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY },
    })
  : null;

console.log(r2Ativo ? `Imagens: R2 (${config.R2_BUCKET})` : "Imagens: disco local (/uploads)");

/**
 * Salva a imagem gerada e devolve a URL.
 * - Produção (R2): URL absoluta e impossível de adivinhar, ex.: https://previas.fachadasmart.com/fachada-logo/<uuid>.jpg
 * - Dev (sem R2): URL relativa /uploads/<arquivo>, servida pelo express.static
 */
export async function salvarImagem(buffer: Buffer, prefixo: string, mimeType = "image/png") {
  const ext = EXTENSOES[mimeType] ?? "png";
  const fileName = `${prefixo}/${randomUUID()}.${ext}`;

  if (r2) {
    await r2.send(
      new PutObjectCommand({
        Bucket: config.R2_BUCKET,
        Key: fileName,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return { fileName, url: `${config.R2_PUBLIC_URL.replace(/\/$/, "")}/${fileName}` };
  }

  const destino = path.join(UPLOADS_DIR, fileName);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, buffer);
  return { fileName, url: `/uploads/${fileName}` };
}

/** Extrai a primeira imagem da resposta do Gemini. Retorna null se o modelo só respondeu texto. */
export function extrairImagemGemini(response: any): { buffer: Buffer; mimeType: string; texto?: string } | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const texto = parts.filter((p: any) => p.text).map((p: any) => p.text).join("\n") || undefined;
  const img = parts.find((p: any) => p.inlineData?.data);
  if (!img) {
    console.warn("Gemini não retornou imagem.", texto ? `Texto: ${texto}` : "");
    return null;
  }
  return {
    buffer: Buffer.from(img.inlineData.data, "base64"),
    mimeType: img.inlineData.mimeType || "image/png",
    texto,
  };
}

export function parseDataUrl(dataUrl: string) {
  const mime = dataUrl.match(/^data:([^;]+);base64,/)?.[1] ?? "image/png";
  const data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  return { mimeType: mime, data };
}
