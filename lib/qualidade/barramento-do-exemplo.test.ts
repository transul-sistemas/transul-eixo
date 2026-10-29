import { describe, expect, it } from "vitest";
import { lerTexto, listarArquivos } from "./armadilhas";
import { barramentoDoExemplo } from "./barramento-do-exemplo";

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
