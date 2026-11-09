import { ErroValidacao } from "../utils/errors";
import { calcularOrcamento } from "./calcular";
import { ItemExtraido, MaterialPreco, TabelaPrecos, Unidade } from "./types";

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

const UNIDADES: Unidade[] = ["m2", "ml", "un"];

function numero(valor: unknown, campo: string, min: number, max = Infinity): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < min || valor > max) {
    const faixa = max === Infinity ? `maior ou igual a ${min}` : `entre ${min} e ${max}`;
    throw new ErroValidacao(`tabelaPrecos: "${campo}" deve ser um número ${faixa}`);
  }
  return valor;
}

/** Valida uma tabela de preços enviada pelo cliente (formato de tabela-padrao.json). */
export function validarTabela(raw: unknown): TabelaPrecos {
  if (!raw || typeof raw !== "object") throw new ErroValidacao('"tabelaPrecos" deve ser um objeto');
  const t = raw as Record<string, unknown>;
  if (!Array.isArray(t.materiais) || t.materiais.length === 0) {
    throw new ErroValidacao('tabelaPrecos: "materiais" deve ser uma lista com pelo menos 1 material');
  }

  const ids = new Set<string>();
  const materiais: MaterialPreco[] = t.materiais.map((m: any, idx: number) => {
    const n = idx + 1;
    if (!m || typeof m !== "object") throw new ErroValidacao(`tabelaPrecos: material ${n} com formato inválido`);
    if (typeof m.id !== "string" || !m.id.trim()) throw new ErroValidacao(`tabelaPrecos: material ${n} sem "id"`);
    if (ids.has(m.id)) throw new ErroValidacao(`tabelaPrecos: id "${m.id}" repetido`);
    ids.add(m.id);
    if (!UNIDADES.includes(m.unidade)) {
      throw new ErroValidacao(`tabelaPrecos: material "${m.id}" com unidade inválida (use m2, ml ou un)`);
    }
    return {
      id: m.id,
      nome: typeof m.nome === "string" && m.nome.trim() ? m.nome.trim() : m.id,
      unidade: m.unidade,
      custoUnitario: numero(m.custoUnitario, `${m.id}.custoUnitario`, 0),
      maoDeObraPorUnidade: numero(m.maoDeObraPorUnidade, `${m.id}.maoDeObraPorUnidade`, 0),
      perdaPercentual: m.perdaPercentual === undefined ? undefined : numero(m.perdaPercentual, `${m.id}.perdaPercentual`, 0, 100),
    };
  });

  return {
    materiais,
    margemPercentual: numero(t.margemPercentual, "margemPercentual", 0, 1000),
    impostoPercentual: numero(t.impostoPercentual, "impostoPercentual", 0, 99),
    taxaInstalacao: numero(t.taxaInstalacao, "taxaInstalacao", 0),
    valorMinimo: numero(t.valorMinimo, "valorMinimo", 0),
  };
}
