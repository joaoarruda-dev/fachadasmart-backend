import { buildPromptExtracao } from "../ai/promptExtracao";
import { openai } from "../config/openai";
import { config } from "../config/env";
import { calcularOrcamento } from "../pricing/calcular";
import { Extracao, ItemExtraido, TabelaPrecos } from "../pricing/types";
import tabelaPadrao from "../pricing/tabela-padrao.json";

const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v > 0 ? v : undefined);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

/** Não confia no formato do LLM: normaliza tudo antes do cálculo. */
function normalizarExtracao(raw: any): Extracao {
  const itens: ItemExtraido[] = (Array.isArray(raw?.itens) ? raw.itens : [])
    .filter((i: any) => typeof i?.materialId === "string")
    .map((i: any) => ({
      materialId: i.materialId,
      descricao: typeof i.descricao === "string" ? i.descricao : i.materialId,
      quantidade: num(i.quantidade) ?? 1,
      largura_m: num(i.largura_m),
      altura_m: num(i.altura_m),
      comprimento_m: num(i.comprimento_m),
    }));
  return {
    itens,
    pendencias: strs(raw?.pendencias),
    premissas: strs(raw?.premissas),
    riscos: strs(raw?.riscos),
    recomendacoes: strs(raw?.recomendacoes),
  };
}

export async function gerarOrcamento(form: unknown, tabela: TabelaPrecos = tabelaPadrao as TabelaPrecos) {
  const completion = await openai.chat.completions.create({
    model: config.OPENAI_MODEL,
    messages: [{ role: "user", content: buildPromptExtracao(form, tabela.materiais) }],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia do modelo");

  const extracao = normalizarExtracao(JSON.parse(content));
  return calcularOrcamento(extracao, tabela);
}

export { normalizarExtracao as _normalizarExtracao };
