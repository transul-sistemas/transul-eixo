import { describe, expect, it } from "vitest";
import {
  esqueletosAbertosDemais,
  esqueletosSemEstruturaOuSobrando,
  estruturasForaDoPadrao,
  tabelasSemOlho,
  telasSemPagina,
} from "./esqueleto-global";

// TESTE DE CONSISTÊNCIA DO ESQUELETO GLOBAL (10/11/2026). O critério (i), "toda lista pagina pelo
// componente padrão com 20 por página", é o de `lista-de-vinte.test.ts`. Estes são os demais.
//
// As PENDÊNCIAS do olho são as tabelas que ainda não o têm. Cada uma tem o motivo; o teste também falha
// quando uma pendência passa a cumprir a regra, para ela sair da lista (a lista só encolhe).

const PENDENCIAS_DO_OLHO: Record<string, string> = {
  // Componentes-base: o olho é da linha, que cada tela monta.
  "components/tabela/tabela-de-dados.tsx": "componente-base: o olho é uma coluna que cada tela põe",
  "components/tabela/tabela-de-placas.tsx":
    "o olho de Placas é o Espiar, na célula da placa (CelulaDaPlaca), não no fim da linha",
  // Telas prontas com tabela que ainda não ganhou o olho no fim da linha.
  "app/(sistema)/frota/placas/pagina-de-placas.tsx": "usa TabelaDePlacas (olho = Espiar na placa)",
  "app/(sistema)/frota/acompanhamento/pagina-do-acompanhamento.tsx":
    "as tabelas do Agora e do Censo (a grade por conjunto tem o olho)",
  "app/(sistema)/frota/analise/pagina-da-analise.tsx": "tabelas das quatro camadas da análise",
  "app/(sistema)/resultados/visao-geral/pagina-da-visao-geral.tsx": "tabela por agrupamento",
  // Não são lista de itens que se abrem: grade de marcação, matriz de permissões e tabelas curtas de ficha.
  "app/(sistema)/pessoas/escala/grade-da-escala.tsx":
    "grade de marcação do mês, não lista de itens",
  "app/(sistema)/admin/usuarios-e-perfis/matriz-do-perfil.tsx": "matriz de permissões, não lista",
  "app/(sistema)/admin/usuarios-e-perfis/tabela-de-usuarios.tsx":
    "a ação da linha é o wizard de acesso",
  "app/(sistema)/cadastros/catalogos/catalogo-interativo.tsx": "a ação da linha é o wizard do item",
  "app/(sistema)/parceiros/lista/[parceiro]/ficha-do-parceiro.tsx":
    "tabelas curtas dentro da ficha",
  "app/(sistema)/pessoas/lista/[pessoa]/tabela-dos-vinculos.tsx": "vínculos curtos dentro da ficha",
  "components/ficha/eventos-da-ficha.tsx": "linha do tempo da ficha",
};

describe("consistência do esqueleto global", () => {
  it("(ii) toda tela do catálogo tem página", () => {
    expect(telasSemPagina()).toEqual([]);
  });

  it("(iii) toda tela esqueleto só abre para Administrador e Diretoria", () => {
    expect(esqueletosAbertosDemais()).toEqual([]);
  });

  it("(iv) toda tela esqueleto tem estrutura registrada, e nenhuma estrutura sobra", () => {
    expect(esqueletosSemEstruturaOuSobrando()).toEqual([]);
  });

  it("(iv) toda estrutura traz KPIs, 2 a 3 painéis que fecham 12 colunas, a tabela e a fonte", () => {
    expect(estruturasForaDoPadrao()).toEqual([]);
  });

  it("(v) toda tabela de dados tem o olho, fora as pendências registradas", () => {
    expect(tabelasSemOlho()).toEqual(Object.keys(PENDENCIAS_DO_OLHO).sort());
  });
});
