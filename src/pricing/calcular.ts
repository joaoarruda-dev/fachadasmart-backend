import { Extracao, ItemExtraido, MaterialPreco, TabelaPrecos } from "./types";

const r2 = (n: number) => Math.round(n * 100) / 100;

function quantidadeBase(item: ItemExtraido, m: MaterialPreco): number | string {
  const q = item.quantidade > 0 ? item.quantidade : 1;
  if (m.unidade === "m2") {
    if (!(item.largura_m! > 0 && item.altura_m! > 0)) return `"${item.descricao}": faltam largura e altura (m²)`;
    return item.largura_m! * item.altura_m! * q;
  }
  if (m.unidade === "ml") {
    if (!(item.comprimento_m! > 0)) return `"${item.descricao}": falta o comprimento (metro linear)`;
    return item.comprimento_m! * q;
  }
  return q;
}

/** Cálculo 100% determinístico: mesma entrada, mesmo preço. */
export function calcularOrcamento(extracao: Extracao, tabela: TabelaPrecos) {
  const pendencias = [...extracao.pendencias];
  const linhas = [];

  for (const item of extracao.itens) {
    const m = tabela.materiais.find((x) => x.id === item.materialId);
    if (!m) {
      pendencias.push(`"${item.descricao}": material "${item.materialId}" não está na tabela`);
      continue;
    }
    const base = quantidadeBase(item, m);
    if (typeof base === "string") {
      pendencias.push(base);
      continue;
    }
    const comPerda = base * (1 + (m.perdaPercentual ?? 0) / 100);
    const custoMaterial = comPerda * m.custoUnitario;
    const maoDeObra = base * m.maoDeObraPorUnidade;
    linhas.push({
      materialId: m.id,
      material: m.nome,
      descricao: item.descricao,
      unidade: m.unidade,
      quantidade: r2(base),
      quantidadeComPerda: r2(comPerda),
      custoMaterial: r2(custoMaterial),
      maoDeObra: r2(maoDeObra),
      subtotal: r2(custoMaterial + maoDeObra),
    });
  }

  const custoMateriais = linhas.reduce((s, l) => s + l.custoMaterial, 0);
  const custoMaoDeObra = linhas.reduce((s, l) => s + l.maoDeObra, 0);
  const custoTotal = custoMateriais + custoMaoDeObra + (linhas.length ? tabela.taxaInstalacao : 0);
  const comMargem = custoTotal * (1 + tabela.margemPercentual / 100);
  const comImposto = comMargem / (1 - tabela.impostoPercentual / 100);
  const precoFinal = linhas.length ? Math.max(comImposto, tabela.valorMinimo) : 0;

  return {
    itens: linhas,
    totais: {
      custoMateriais: r2(custoMateriais),
      custoMaoDeObra: r2(custoMaoDeObra),
      taxaInstalacao: linhas.length ? tabela.taxaInstalacao : 0,
      custoTotal: r2(custoTotal),
      margemPercentual: tabela.margemPercentual,
      impostoPercentual: tabela.impostoPercentual,
      precoSugerido: r2(precoFinal),
      aplicouValorMinimo: linhas.length > 0 && comImposto < tabela.valorMinimo,
    },
    completo: pendencias.length === 0,
    pendencias,
    premissas: extracao.premissas,
    riscos: extracao.riscos,
    recomendacoes: extracao.recomendacoes,
  };
}
