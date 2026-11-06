import { gemini } from "../config/gemini";
import { extrairImagemGemini, salvarImagem } from "../utils/storage";

const MODEL = "gemini-2.5-flash-image";

const PROMPT = `Remova desta fachada comercial TODOS os logos, letreiros, textos e elementos de identidade visual.

Mantenha exatamente:
- estrutura, formato, janelas, portas e proporções
- cores, materiais e texturas originais
- iluminação, perspectiva e enquadramento

As áreas limpas devem ficar naturais e contínuas com o restante da fachada.
Resultado: a mesma foto, mesma fachada, apenas sem identificação visual.`;

export async function limparImagem(imageBuffer: Buffer, mimeType = "image/png") {
  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: [
      { text: PROMPT },
      { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
    ],
  });

  const img = extrairImagemGemini(response);
  return img ? salvarImagem(img.buffer, "limpeza", img.mimeType) : null;
}
