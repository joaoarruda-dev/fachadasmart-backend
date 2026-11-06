import { ErroValidacao } from "../utils/errors";
import { calcularOrcamento } from "./calcular";
import { ItemExtraido, TabelaPrecos } from "./types";

const MAX_ITENS = 100;
const MAX_MEDIDA_M = 200; // acima disso quase sempre é cm digitado como metro

function medida(valor: unknown, campo: string, n: number): number | undefined {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    throw new ErroValidacao(`Item ${n}: "${campo}" deve ser um número maior que zero (em metros)`);
  }
  if (valor > MAX_MEDIDA_M) {
    throw new ErroValidacao(`Item ${n}: "${campo}" = ${valor} m parece estar em centímetros; envie em metros`);
  }
  return valor;
}

/** Valida itens enviados prontos pelo formulário. Medida faltando não é erro: vira pendência no cálculo. */
export function validarItens(raw: unknown, tabela: TabelaPrecos): ItemExtraido[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ErroValidacao('"itens" deve ser uma lista com pelo menos 1 item');
  }
  if (raw.length > MAX_ITENS) throw new ErroValidacao(`Máximo de ${MAX_ITENS} itens por orçamento`);

  return raw.map((i: any, idx) => {
    const n = idx + 1;
    if (!i || typeof i !== "object") throw new ErroValidacao(`Item ${n}: formato inválido`);
    const material = tabela.materiais.find((m) => m.id === i.materialId);
    if (!material) throw new ErroValidacao(`Item ${n}: material "${i.materialId}" não está na tabela de preços`);

    const quantidade = i.quantidade ?? 1;
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new ErroValidacao(`Item ${n}: "quantidade" deve ser um número inteiro de peças maior que zero`);
    }

    return {
      materialId: material.id,
      descricao: typeof i.descricao === "string" && i.descricao.trim() ? i.descricao.trim() : material.nome,
      quantidade,
      largura_m: medida(i.largura_m, "largura_m", n),
      altura_m: medida(i.altura_m, "altura_m", n),
      comprimento_m: medida(i.comprimento_m, "comprimento_m", n),
    };
  });
}

/** Orçamento sem IA: itens estruturados → cálculo determinístico. */
export function orcamentoPorItens(raw: unknown, tabela: TabelaPrecos) {
  const itens = validarItens(raw, tabela);
  return calcularOrcamento({ itens, pendencias: [], premissas: [], riscos: [], recomendacoes: [] }, tabela);
}
