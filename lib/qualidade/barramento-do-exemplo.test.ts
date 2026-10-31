import { describe, expect, it } from "vitest";
import { lerTexto, listarArquivos } from "./armadilhas";
import {
  barramentoDoExemplo,
  clienteImportaAFonte,
  fonteDeExemploImportadaFora,
} from "./barramento-do-exemplo";

const IMPORTA = 'import { placasDeExemplo } from "@/lib/exemplo/placas";';

describe("barramento: lib/exemplo/ só entra pelas portas liberadas", () => {
  it("acusa tela de produção que importa o exemplo", () => {
    expect(
      barramentoDoExemplo([{ caminho: "app/(sistema)/frota/placas/page.tsx", texto: IMPORTA }]),
    ).toEqual(["app/(sistema)/frota/placas/page.tsx"]);
  });
  it("acusa componente, lib/dados fora da fonte, import relativo, dinâmico, require e reexport", () => {
    const acusados = barramentoDoExemplo([
      { caminho: "components/x.tsx", texto: IMPORTA },
      { caminho: "lib/dados/placas.ts", texto: IMPORTA },
      { caminho: "lib/dados/outra.ts", texto: 'import { a } from "../exemplo/placas";' },
      {
        caminho: "lib/dados/dinamico.ts",
        texto: 'const m = await import("@/lib/exemplo/placas");',
      },
      { caminho: "lib/dados/antigo.ts", texto: 'const m = require("@/lib/exemplo/placas");' },
      { caminho: "lib/dados/reexporta.ts", texto: 'export * from "@/lib/exemplo/placas";' },
    ]);
    expect([...acusados].sort()).toEqual([
      "components/x.tsx",
      "lib/dados/antigo.ts",
      "lib/dados/dinamico.ts",
      "lib/dados/outra.ts",
      "lib/dados/placas.ts",
      "lib/dados/reexporta.ts",
    ]);
  });
  it("libera a fonte de exemplo, os testes, a própria pasta e as telas de desenvolvimento", () => {
    expect(
      barramentoDoExemplo([
        { caminho: "lib/dados/fonte-de-exemplo.ts", texto: IMPORTA },
        { caminho: "lib/dados/placas.test.ts", texto: IMPORTA },
        { caminho: "components/x.test.tsx", texto: IMPORTA },
        { caminho: "e2e/placas.spec.ts", texto: IMPORTA },
        { caminho: "lib/exemplo/placas.ts", texto: 'import { a } from "./casos-feios";' },
        { caminho: "app/(sistema)/admin/desenvolvimento/page.tsx", texto: IMPORTA },
      ]),
    ).toEqual([]);
  });
  it("não acusa quem só cita o caminho em texto ou comentário", () => {
    expect(
      barramentoDoExemplo([
        {
          caminho: "components/x.tsx",
          texto: "// os dados ficam em lib/exemplo/ (não importe daqui)",
        },
      ]),
    ).toEqual([]);
  });
  it("não confunde pastas com nome parecido", () => {
    expect(
      barramentoDoExemplo([
        { caminho: "components/x.tsx", texto: 'import a from "@/lib/exemplos-de-uso/a";' },
      ]),
    ).toEqual([]);
  });
});

describe("no repositório de verdade", () => {
  it("nenhum arquivo fora das portas importa lib/exemplo/", () => {
    const arquivos = ["app", "components", "lib", "e2e", "workers", "supabase"]
      .flatMap((pasta) => listarArquivos(pasta, /\.(ts|tsx|mjs|js)$/))
      .map((caminho) => ({ caminho, texto: lerTexto(caminho) }));
    expect(barramentoDoExemplo(arquivos)).toEqual([]);
  });
});

describe("barramento: o navegador nunca importa a fonte de dados", () => {
  const CLIENTE = '"use client";\n';
  it("acusa componente client que importa a fonte, a fonte de exemplo ou listarPlacas", () => {
    const acusados = clienteImportaAFonte([
      {
        caminho: "components/a.tsx",
        texto: `${CLIENTE}import { listarPlacas } from "@/lib/dados/placas";`,
      },
      { caminho: "components/b.tsx", texto: `${CLIENTE}import { f } from "@/lib/dados/fonte";` },
      {
        caminho: "components/c.tsx",
        texto: `${CLIENTE}import { f } from "@/lib/dados/fonte-de-exemplo";`,
      },
      {
        caminho: "components/d.tsx",
        texto: `${CLIENTE}const m = await import("@/lib/dados/placas");`,
      },
    ]);
    expect([...acusados].sort()).toEqual([
      "components/a.tsx",
      "components/b.tsx",
      "components/c.tsx",
      "components/d.tsx",
    ]);
  });
  it("deixa o client usar os tipos (placas-tipos) e o servidor usar a fonte", () => {
    expect(
      clienteImportaAFonte([
        {
          caminho: "components/a.tsx",
          texto: `${CLIENTE}import { T } from "@/lib/dados/placas-tipos";`,
        },
        { caminho: "app/x/page.tsx", texto: 'import { listarPlacas } from "@/lib/dados/placas";' },
      ]),
    ).toEqual([]);
  });
  it("acusa o arquivo SEM a diretiva que um client importa e que importa a fonte (cadeia de um nível)", () => {
    expect(
      clienteImportaAFonte([
        { caminho: "components/painel.tsx", texto: `${CLIENTE}import { R } from "./resumo";` },
        {
          caminho: "components/resumo.tsx",
          texto: 'import { listarPlacas } from "@/lib/dados/placas";',
        },
      ]),
    ).toEqual(["components/resumo.tsx"]);
  });
  it("segue cadeias de vários níveis, com alias, caminho relativo, extensão e index", () => {
    const acusados = clienteImportaAFonte([
      { caminho: "components/a.tsx", texto: `${CLIENTE}import { B } from "@/components/ficha/b";` },
      {
        caminho: "components/ficha/b.tsx",
        texto: 'import { C } from "../comum/c";\nimport { D } from "./d";',
      },
      { caminho: "components/comum/c.ts", texto: 'import { E } from "@/lib/uteis";' },
      { caminho: "components/ficha/d/index.tsx", texto: 'import { f } from "@/lib/dados/fonte";' },
      { caminho: "lib/uteis/index.ts", texto: "export const E = 1;" },
    ]);
    expect(acusados).toEqual(["components/ficha/d/index.tsx"]);
  });
  it("não acusa o arquivo de servidor que importa a fonte mas nenhum client alcança", () => {
    expect(
      clienteImportaAFonte([
        { caminho: "components/a.tsx", texto: `${CLIENTE}import { T } from "./tipos";` },
        {
          caminho: "components/tipos.ts",
          texto: 'import type { X } from "@/lib/dados/placas-tipos";',
        },
        { caminho: "app/x/page.tsx", texto: 'import { listarPlacas } from "@/lib/dados/placas";' },
        { caminho: "app/x/outro.tsx", texto: 'import { listarPlacas } from "@/lib/dados/placas";' },
      ]),
    ).toEqual([]);
  });
  it("importação circular termina e ainda acusa quem importa a fonte", () => {
    expect(
      clienteImportaAFonte([
        { caminho: "components/a.tsx", texto: `${CLIENTE}import { B } from "./b";` },
        {
          caminho: "components/b.tsx",
          texto: 'import { A } from "./a";\nimport { C } from "./c";',
        },
        {
          caminho: "components/c.tsx",
          texto: 'import { B } from "./b";\nimport { f } from "@/lib/dados/fonte";',
        },
      ]),
    ).toEqual(["components/c.tsx"]);
  });
  it("pacotes de fora e caminhos que não existem são ignorados, sem erro", () => {
    expect(
      clienteImportaAFonte([
        {
          caminho: "components/a.tsx",
          texto: `${CLIENTE}import React from "react";
import { x } from "./nao-existe";
import y from "@/lib/nao/existe";`,
        },
      ]),
    ).toEqual([]);
  });
  it("não conta duas vezes o mesmo arquivo alcançado por dois clients", () => {
    expect(
      clienteImportaAFonte([
        { caminho: "components/a.tsx", texto: `${CLIENTE}import { C } from "./c";` },
        { caminho: "components/b.tsx", texto: `${CLIENTE}import { C } from "./c";` },
        { caminho: "components/c.tsx", texto: 'import { f } from "@/lib/dados/fonte";' },
      ]),
    ).toEqual(["components/c.tsx"]);
  });
  it("aceita caminhos com barra invertida (Windows) e devolve o caminho como veio", () => {
    expect(
      clienteImportaAFonte([
        { caminho: "components\\a.tsx", texto: `${CLIENTE}import { B } from "./b";` },
        { caminho: "components\\b.tsx", texto: 'import { f } from "@/lib/dados/fonte";' },
      ]),
    ).toEqual(["components\\b.tsx"]);
  });
  it("no repositório de verdade, nenhum client importa a fonte", () => {
    const arquivos = ["app", "components", "lib"]
      .flatMap((pasta) => listarArquivos(pasta, /\.(ts|tsx)$/))
      .map((caminho) => ({ caminho, texto: lerTexto(caminho) }));
    expect(clienteImportaAFonte(arquivos)).toEqual([]);
  });
});

describe("barramento: a fonte de exemplo só entra por lib/dados/fonte.ts", () => {
  it("acusa quem importa a fonte de exemplo fora de fonte.ts e dos testes", () => {
    expect(
      fonteDeExemploImportadaFora([
        { caminho: "lib/dados/placas.ts", texto: 'import { f } from "./fonte-de-exemplo";' },
        {
          caminho: "app/x/page.tsx",
          texto: 'const m = await import("@/lib/dados/fonte-de-exemplo");',
        },
        { caminho: "lib/dados/fonte.ts", texto: 'await import("./fonte-de-exemplo");' },
        {
          caminho: "lib/dados/placas.test.ts",
          texto: 'import { comparar } from "./fonte-de-exemplo";',
        },
      ]).sort(),
    ).toEqual(["app/x/page.tsx", "lib/dados/placas.ts"]);
  });
  it("no repositório de verdade, só fonte.ts", () => {
    const arquivos = ["app", "components", "lib", "e2e"]
      .flatMap((pasta) => listarArquivos(pasta, /\.(ts|tsx)$/))
      .map((caminho) => ({ caminho, texto: lerTexto(caminho) }));
    expect(fonteDeExemploImportadaFora(arquivos)).toEqual([]);
  });
});
