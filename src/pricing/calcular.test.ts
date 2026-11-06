import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularOrcamento, corrigirQuantidadeDuplicada } from "./calcular";
import { Extracao, TabelaPrecos } from "./types";
import tabelaPadrao from "./tabela-padrao.json";

const tabela = tabelaPadrao as TabelaPrecos;

// Caso real (Padaria Ferreira): o LLM repetiu a área de 6 m² em "quantidade".
const extracaoPadaria: Extracao = {
  itens: [
    { materialId: "acm", descricao: "Testeira em ACM", quantidade: 6, largura_m: 5, altura_m: 1.2 },
    { materialId: "estrutura-metalica", descricao: "Estrutura da testeira", quantidade: 6, largura_m: 5, altura_m: 1.2 },
    { materialId: "letra-caixa", descricao: "Letras PADARIA", quantidade: 7 },
    { materialId: "fonte-led", descricao: "Fonte LED", quantidade: 1 },
    { materialId: "fita-led", descricao: "Fita LED das letras", quantidade: 1 },
  ],
  pendencias: [],
  premissas: [],
  riscos: [],
  recomendacoes: [],
};

test("área repetida em quantidade não é contada duas vezes", () => {
  const r = calcularOrcamento(corrigirQuantidadeDuplicada(extracaoPadaria, tabela), tabela);
  assert.equal(r.itens.find((i) => i.materialId === "acm")?.quantidade, 6);
  assert.equal(r.itens.find((i) => i.materialId === "estrutura-metalica")?.quantidade, 6);
  assert.equal(r.totais.custoTotal, 3853);
  assert.equal(r.totais.precoSugerido, 5738.51);
  assert.equal(r.completo, false); // fita LED sem comprimento
});

test("sem a correção, o mesmo pedido sairia 36 m² (regressão)", () => {
  const r = calcularOrcamento(extracaoPadaria, tabela);
  assert.equal(r.itens.find((i) => i.materialId === "acm")?.quantidade, 36);
});

test("peças repetidas de verdade são mantidas", () => {
  const extracao: Extracao = {
    itens: [{ materialId: "acm", descricao: "2 painéis 3 x 1 m", quantidade: 2, largura_m: 3, altura_m: 1 }],
    pendencias: [], premissas: [], riscos: [], recomendacoes: [],
  };
  const corrigida = corrigirQuantidadeDuplicada(extracao, tabela);
  assert.equal(corrigida.itens[0].quantidade, 2);
  assert.equal(corrigida.premissas.length, 0);
});

test("comprimento repetido em quantidade (ml) também é corrigido", () => {
  const extracao: Extracao = {
    itens: [{ materialId: "fita-led", descricao: "Fita LED", quantidade: 12, comprimento_m: 12 }],
    pendencias: [], premissas: [], riscos: [], recomendacoes: [],
  };
  const corrigida = corrigirQuantidadeDuplicada(extracao, tabela);
  assert.equal(corrigida.itens[0].quantidade, 1);
  assert.equal(corrigida.premissas.length, 1);
});

// Limitação conhecida: se o número de peças coincidir com a área de cada peça
// (2 painéis de 2 x 1 m), não dá para distinguir do erro. A correção vale e fica
// registrada em premissas, para o orçamentista conferir.
test("coincidência peças = área: corrige e avisa em premissas", () => {
  const extracao: Extracao = {
    itens: [{ materialId: "acm", descricao: "2 painéis 2 x 1 m", quantidade: 2, largura_m: 2, altura_m: 1 }],
    pendencias: [], premissas: [], riscos: [], recomendacoes: [],
  };
  const corrigida = corrigirQuantidadeDuplicada(extracao, tabela);
  assert.equal(corrigida.itens[0].quantidade, 1);
  assert.match(corrigida.premissas[0], /considerada 1 peça/);
});
