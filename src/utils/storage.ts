import * as fs from "node:fs";
import * as path from "node:path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/** Salva a imagem em /uploads e devolve a URL pública (servida pelo express.static). */
export function salvarImagem(buffer: Buffer, prefixo: string) {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const fileName = `${prefixo}-${Date.now()}.png`;
  fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
  return { fileName, url: `/uploads/${fileName}` };
}

/** Extrai a primeira imagem da resposta do Gemini. Retorna null se o modelo só respondeu texto. */
export function extrairImagemGemini(response: any): { buffer: Buffer; texto?: string } | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const texto = parts.filter((p: any) => p.text).map((p: any) => p.text).join("\n") || undefined;
  const img = parts.find((p: any) => p.inlineData?.data);
  if (!img) {
    console.warn("Gemini não retornou imagem.", texto ? `Texto: ${texto}` : "");
    return null;
  }
  return { buffer: Buffer.from(img.inlineData.data, "base64"), texto };
}

export function parseDataUrl(dataUrl: string) {
  const mime = dataUrl.match(/^data:([^;]+);base64,/)?.[1] ?? "image/png";
  const data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  return { mimeType: mime, data };
}
