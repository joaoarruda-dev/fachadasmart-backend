export type Unidade = "m2" | "ml" | "un";

export type MaterialPreco = {
  id: string;
  nome: string;
  unidade: Unidade;
  custoUnitario: number;        // custo do material por unidade (R$)
  maoDeObraPorUnidade: number;  // R$ por unidade produzida/instalada
  perdaPercentual?: number;     // ex.: 10 = 10% de sobra/corte
};

export type TabelaPrecos = {
  materiais: MaterialPreco[];
  margemPercentual: number;   // sobre o custo
  impostoPercentual: number;  // sobre o preço de venda (gross-up)
  taxaInstalacao: number;     // fixo por orçamento
  valorMinimo: number;        // preço final mínimo
};

/** O que o LLM devolve: só quantidades, nunca preço. */
export type ItemExtraido = {
  materialId: string;
  descricao: string;
  quantidade: number;
  largura_m?: number;
  altura_m?: number;
  comprimento_m?: number;
};

export type Extracao = {
  itens: ItemExtraido[];
  pendencias: string[];
  premissas: string[];
  riscos: string[];
  recomendacoes: string[];
};
