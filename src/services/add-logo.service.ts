import { gemini } from "../config/gemini";
import { extrairImagemGemini, parseDataUrl, salvarImagem } from "../utils/storage";

export type TextElement = {
  text: string;
  position: string;
  style: string;
};

export type LogoElement = {
  description: string;
  imageData: string; // data URL base64
  position: string;
  size: string;
};

export type AddLogoParams = {
  fachadaBuffer: Buffer;
  fachadaMimeType: string;
  /** Opcional: captura do editor. Sem ela (fluxo do wizard), a IA decide o posicionamento. */
  referenciaBuffer?: Buffer;
  referenciaMimeType?: string;
  textElements?: TextElement[];
  logoElements?: LogoElement[];
  cores?: string;
  materiais?: string;
  extras?: string;
};

const NANO_BANANA_PRO_MODEL = "gemini-3-pro-image-preview";

function montarPrompt(p: AddLogoParams) {
  const logos = p.logoElements ?? [];
  const textos = p.textElements ?? [];
  const materiais = p.materiais || "material de comunicação visual profissional (ex.: ACM, letra caixa)";
  const temReferencia = !!p.referenciaBuffer;
  const primeiroLogo = temReferencia ? 3 : 2;
  const ultimoLogo = primeiroLogo + logos.length - 1;

  const linhas: string[] = [];

  linhas.push(`Você é especialista em comunicação visual e edição fotográfica de fachadas.

TAREFA
Edite a IMAGEM 1 (fachada base) instalando nela os logos e textos descritos abaixo,
como peças físicas de comunicação visual.
${
  temReferencia
    ? "A IMAGEM 2 é apenas referência de estilo e posicionamento."
    : `Não há imagem de referência: escolha você o melhor posicionamento, na área natural de letreiro
(testeira, faixa acima da porta ou parede principal), respeitando a posição indicada para cada elemento
e com tamanho proporcional à fachada.`
}

IMAGENS
- IMAGEM 1: fachada base. É a foto que deve ser editada.
${temReferencia ? "- IMAGEM 2: referência de como os elementos devem ficar (estilo, posição, proporção).\n" : ""}${
    logos.length
      ? `- ${logos.length === 1 ? `IMAGEM ${primeiroLogo}` : `IMAGENS ${primeiroLogo} a ${ultimoLogo}`}: arquivos dos logos, na ordem listada abaixo.`
      : ""
  }

REGRAS DA FACHADA (não negociáveis)
- Mesmo enquadramento, proporção e dimensões da IMAGEM 1. Não expandir, cortar, duplicar ou espelhar.
- Parede, janelas, portas e estrutura permanecem idênticas.${
    temReferencia ? "\n- Não usar a IMAGEM 2 como base; ela serve só de exemplo." : ""
  }`);

  if (logos.length) {
    linhas.push(`\nLOGOS`);
    logos.forEach((l, i) => {
      linhas.push(`${i + 1}. ${l.description} — arquivo: IMAGEM ${primeiroLogo + i}
   - posição: ${l.position}
   - tamanho: ${l.size}`);
    });
  }

  if (textos.length) {
    linhas.push(`\nTEXTOS`);
    textos.forEach((t, i) => {
      linhas.push(`${i + 1}. Conteúdo exato: "${t.text}"
   - posição: ${t.position}
   - estilo: ${t.style}`);
    });
  }

  linhas.push(`
FIDELIDADE GRÁFICA
- Reproduza cada logo exatamente como no arquivo: mesmas formas, cores, proporções e tipografia. Não redesenhe.
- Textos com a grafia exata, sem letras trocadas ou faltando.

MATERIAL E REALISMO
- Material: ${materiais}.
- O realismo vem da peça física, não de efeitos sobre a arte: espessura/profundidade, textura e
  acabamento do material, fixações quando aplicável.
- Iluminação coerente com o material (LED/backlight se for iluminado; sem brilho se não for)
  e com a luz ambiente da foto, incluindo a sombra projetada na parede.
- Os elementos devem parecer construídos e instalados na fachada real.`);

  if (p.cores) linhas.push(`\nCores adicionais: ${p.cores}`);
  if (p.extras) linhas.push(`Observações do cliente: ${p.extras}`);

  linhas.push(`
RESULTADO
A IMAGEM 1, inalterada fora das áreas dos elementos, com os logos e textos instalados
como comunicação visual física, fotorrealista.`);

  return linhas.join("\n");
}

export async function adicionarLogo(params: AddLogoParams) {
  const contents: any[] = [
    { text: montarPrompt(params) },
    { inlineData: { mimeType: params.fachadaMimeType, data: params.fachadaBuffer.toString("base64") } },
  ];
  if (params.referenciaBuffer) {
    contents.push({
      inlineData: {
        mimeType: params.referenciaMimeType || "image/png",
        data: params.referenciaBuffer.toString("base64"),
      },
    });
  }
  for (const l of params.logoElements ?? []) contents.push({ inlineData: parseDataUrl(l.imageData) });

  const response = await gemini.models.generateContent({
    model: NANO_BANANA_PRO_MODEL,
    contents,
  });

  const img = extrairImagemGemini(response);
  return img ? salvarImagem(img.buffer, "fachada-logo", img.mimeType) : null;
}

export { montarPrompt as _montarPromptAddLogo };
