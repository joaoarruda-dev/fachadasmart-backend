import { Request, Response } from "express";
import { limparImagem } from "../services/clear-image.service";
import { adicionarLogo } from "../services/add-logo.service";
import { gerarOrcamento } from "../services/orcamento.service";
import { TIPOS_ACEITOS as TIPOS_IMAGEM } from "../utils/fileUpload";

type Files = Record<string, Express.Multer.File[]> | undefined;

function parseJsonCampo<T>(valor: unknown, nome: string): T | undefined {
  if (valor === undefined || valor === "") return undefined;
  if (typeof valor !== "string") return valor as T;
  try {
    return JSON.parse(valor) as T;
  } catch {
    throw new ErroValidacao(`Campo "${nome}" não é um JSON válido`);
  }
}

class ErroValidacao extends Error {}

function responderErro(res: Response, err: unknown, msg: string) {
  if (err instanceof ErroValidacao) return res.status(400).json({ error: err.message });
  console.error(msg, err);
  return res.status(500).json({ error: msg });
}

export async function orcamentoFachada(req: Request, res: Response) {
  try {
    const { form, tabelaPrecos } = req.body ?? {};
    if (!form) return res.status(400).json({ error: 'Envie "form" no corpo da requisição' });
    const resultado = await gerarOrcamento(form, tabelaPrecos);
    return res.json(resultado);
  } catch (err) {
    return responderErro(res, err, "Erro ao gerar orçamento");
  }
}

export async function limparImagemFachada(req: Request, res: Response) {
  try {
    const imageFile = req.file;
    if (!imageFile) return res.status(400).json({ error: "Nenhuma imagem foi enviada" });

    console.log(`limpar-imagem: ${imageFile.originalname} (${imageFile.mimetype}, ${Math.round(imageFile.size / 1024)}KB)`);
    const saved = await limparImagem(imageFile.buffer, imageFile.mimetype);
    if (!saved) return res.status(502).json({ error: "O modelo não retornou imagem. Tente novamente." });

    return res.json({ success: true, imageUrl: saved.url, message: "Imagem limpa com sucesso" });
  } catch (err) {
    return responderErro(res, err, "Erro ao limpar imagem");
  }
}

export async function adicionarLogoFachada(req: Request, res: Response) {
  try {
    const files = req.files as Files;
    const fachadaFile = files?.fachada?.[0];
    const referenciaFile = files?.referencia?.[0];

    if (!fachadaFile) return res.status(400).json({ error: "É necessário enviar a imagem da fachada" });

    const { cores, materiais, extras } = req.body;
    const textElements = parseJsonCampo<any[]>(req.body.textElements, "textElements");
    const logoElements = parseJsonCampo<any[]>(req.body.logoElements, "logoElements");

    if (!logoElements?.length && !textElements?.length) {
      return res.status(400).json({ error: "Envie ao menos um logo (logoElements) ou texto (textElements)" });
    }
    for (const [i, l] of (logoElements ?? []).entries()) {
      const mime = typeof l?.imageData === "string" ? l.imageData.match(/^data:([^;]+);base64,/)?.[1] : undefined;
      if (!mime || !TIPOS_IMAGEM.includes(mime)) {
        return res.status(400).json({ error: `Logo ${i + 1}: envie PNG, JPEG ou WEBP em data URL base64` });
      }
    }

    console.log(
      `adicionar-logo: ${logoElements?.length ?? 0} logo(s), ${textElements?.length ?? 0} texto(s), referência: ${referenciaFile ? "sim" : "não"}`
    );

    const saved = await adicionarLogo({
      fachadaBuffer: fachadaFile.buffer,
      fachadaMimeType: fachadaFile.mimetype,
      referenciaBuffer: referenciaFile?.buffer,
      referenciaMimeType: referenciaFile?.mimetype,
      textElements,
      logoElements,
      cores,
      materiais,
      extras,
    });

    if (!saved) return res.status(502).json({ error: "O modelo não retornou imagem. Tente novamente." });

    return res.json({ success: true, imageUrl: saved.url, message: "Logo adicionado à fachada com sucesso" });
  } catch (err) {
    return responderErro(res, err, "Erro ao adicionar logo à fachada");
  }
}
