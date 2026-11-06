import { MaterialPreco } from "../pricing/types";

export function buildPromptExtracao(form: unknown, materiais: MaterialPreco[]) {
  const catalogo = materiais.map((m) => ({ id: m.id, nome: m.nome, unidade: m.unidade }));
  return `Você é orçamentista de comunicação visual (fachadas e letreiros).
Leia o pedido do cliente e transforme em uma lista de itens de produção.

PEDIDO DO CLIENTE:
${JSON.stringify(form, null, 2)}

CATÁLOGO DE MATERIAIS (use SOMENTE estes ids):
${JSON.stringify(catalogo, null, 2)}

REGRAS
- NÃO calcule preços. Apenas identifique itens e quantidades.
- Unidade "m2": informe largura_m e altura_m. "ml": informe comprimento_m. "un": informe quantidade.
- Medidas sempre em metros. Converta cm/mm.
- Inclua itens implícitos tecnicamente necessários (ex.: fonte para LED, estrutura para ACM) e registre isso em "premissas".
- Se faltar uma medida essencial, NÃO invente: deixe o campo ausente e descreva em "pendencias".
- Se algo pedido não existir no catálogo, registre em "pendencias".

Responda EXCLUSIVAMENTE em JSON:
{
  "itens": [{ "materialId": "", "descricao": "", "quantidade": 1, "largura_m": 0, "altura_m": 0, "comprimento_m": 0 }],
  "pendencias": [],
  "premissas": [],
  "riscos": [],
  "recomendacoes": []
}`;
}
