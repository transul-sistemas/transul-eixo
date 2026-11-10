import { describe, expect, it } from "vitest";
import {
  listasPropriasSemPaginacaoPadrao,
  padroesDeTamanhoDiferenteDe20,
  pastasSemPaginacaoPadrao,
} from "./lista-de-vinte";

// CRITÉRIO (i) DO TESTE DE CONSISTÊNCIA DO "ESQUELETO GLOBAL" (fatia seguinte): toda tabela de dados
// usa o componente padrão de paginação (Paginador, ou PaginasDaLista com o seletor) e abre com 20
// linhas por página; 20, 50 e 100 lembrados por pessoa no cookie único `eixo-tam-pagina`.
// Regra de Alexandre, 10/11/2026 (docs/padrao-de-telas.md).
//
// As PENDÊNCIAS abaixo são as listas que ainda não cumprem a regra. Cada uma tem o motivo; o teste
// também falha quando uma pendência passa a cumprir a regra, para ela sair da lista (a lista só
// encolhe). Nenhuma pendência nova entra sem aprovação.

const PENDENCIAS_DE_PASTA: Record<string, string> = {
  // O banco devolve a lista inteira: paginar exige p_pagina e p_tam em função de leitura existente
  // (nucleo.operacoes_do_mes e a de parceiros), mudança que vai ao checkpoint do Opus.
  "app/(sistema)/operacoes/lista": "nucleo.operacoes_do_mes sem p_pagina/p_tam",
  "app/(sistema)/parceiros/lista": "função de leitura dos parceiros sem p_pagina/p_tam",
  // Catálogo e usuários: fora do pedido de 10/11/2026; paginam (ou não) do seu jeito.
  "app/(sistema)/cadastros/catalogos": "catálogo com página própria de 50 linhas",
  "app/(sistema)/admin/usuarios-e-perfis": "tabela de usuários sem paginação",
};

const PENDENCIAS_DE_TAMANHO: Record<string, string> = {
  "lib/navegacao/operacoes.ts:PADRAO_DAS_OPERACOES=100": "mesma pendência da lista de Operações",
  "lib/navegacao/parceiros.ts:PADRAO_DOS_PARCEIROS=100": "mesma pendência da lista de Parceiros",
};

describe("toda lista de dados pagina pelo componente padrão (critério i do esqueleto global)", () => {
  it("só as pendências registradas ficam sem o Paginador/seletor padrão", () => {
    expect(pastasSemPaginacaoPadrao()).toEqual(Object.keys(PENDENCIAS_DE_PASTA).sort());
  });

  it("Acompanhamento, Carteira, Pátio e Ordens usam o seletor e o cookie único", () => {
    expect(listasPropriasSemPaginacaoPadrao()).toEqual([]);
  });

  it("todo padrão de tabela abre com 20 linhas, fora as pendências", () => {
    expect(padroesDeTamanhoDiferenteDe20()).toEqual(Object.keys(PENDENCIAS_DE_TAMANHO).sort());
  });
});
