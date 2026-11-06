import { test } from "node:test";
import assert from "node:assert/strict";
import { orcamentoPorItens, validarItens } from "./itens";
import { TabelaPrecos } from "./types";
import { ErroValidacao } from "../utils/errors";
import tabelaPadrao from "./tabela-padrao.json";

const tabela = tabelaPadrao as TabelaPrecos;

test("itens completos calculam sem IA, igual ao caso da padaria", () => {
  const r = orcamentoPorItens(
    [
      { materialId: "acm", largura_m: 5, altura_m: 1.2 },
      { materialId: "estrutura-metalica", largura_m: 5, altura_m: 1.2 },
      { materialId: "letra-caixa", quantidade: 7 },
      { materialId: "fonte-led" },
    ],
    tabela
  );
  assert.equal(r.totais.custoTotal, 3853);
  assert.equal(r.totais.precoSugerido, 5738.51);
  assert.equal(r.completo, true);
  assert.equal(r.itens[0].descricao, "Revestimento em ACM"); // sem descrição → nome do material
});

test("medida faltando vira pendência, não erro", () => {
  const r = orcamentoPorItens([{ materialId: "fita-led" }], tabela);
  assert.equal(r.completo, false);
  assert.match(r.pendencias[0], /falta o comprimento/);
});

test("entradas inválidas viram ErroValidacao (400)", () => {
  const casos: [unknown, RegExp][] = [
    [[], /pelo menos 1 item/],
    ["acm", /pelo menos 1 item/],
    [[{ materialId: "madeira" }], /não está na tabela/],
    [[{ materialId: "acm", quantidade: 1.5 }], /número inteiro/],
    [[{ materialId: "acm", quantidade: 0 }], /número inteiro/],
    [[{ materialId: "acm", largura_m: -1, altura_m: 1 }], /maior que zero/],
    [[{ materialId: "acm", largura_m: "5", altura_m: 1 }], /maior que zero/],
    [[{ materialId: "acm", largura_m: 500, altura_m: 120 }], /centímetros/],
  ];
  for (const [entrada, msg] of casos) {
    assert.throws(() => validarItens(entrada, tabela), (e: unknown) => e instanceof ErroValidacao && msg.test(e.message));
  }
});
