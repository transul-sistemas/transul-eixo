import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { leiturasForaDoSuspense, rotaEhPreRenderizada } from "./leitura-em-suspense.ts";

function arquivos(pasta: string, nomes: readonly string[]): string[] {
  return readdirSync(pasta).flatMap((n) => {
    const caminho = join(pasta, n);
    if (statSync(caminho).isDirectory()) return arquivos(caminho, nomes);
    return nomes.includes(n) ? [caminho] : [];
  });
}

describe("leitura de searchParams, params, cookies e headers dentro de Suspense", () => {
  it("controle negativo: o código antigo da legenda é pego", () => {
    const antigo = `export default async function Pagina({ searchParams }: { searchParams: Busca }) {
      const bruto = (await searchParams).busca;
      return <div>{bruto}</div>;
    }`;
    expect(leiturasForaDoSuspense(antigo).length).toBeGreaterThan(0);
  });

  it.each(["await cookies()", "const h = headers();", "await connection();"])(
    "pega %s direto na página",
    (linha) => {
      const codigo = `export default async function P() { ${linha}; return null; }`;
      expect(leiturasForaDoSuspense(codigo).length).toBeGreaterThan(0);
    },
  );

  it("o padrão das irmãs passa: a página síncrona só repassa e quem lê fica dentro do Suspense", () => {
    const novo = `async function Legenda({ searchParams }) { const x = (await searchParams).busca; return x; }
    export default function Pagina({ searchParams }) {
      return <Suspense fallback={null}><Legenda searchParams={searchParams} /></Suspense>;
    }`;
    expect(leiturasForaDoSuspense(novo)).toEqual([]);
  });

  it("rota com [segmento] não é pré-renderizada", () => {
    expect(rotaEhPreRenderizada("app/(sistema)/frota/placas/[placa]/page.tsx")).toBe(false);
    expect(rotaEhPreRenderizada("app/(sistema)/frota/acompanhamento/page.tsx")).toBe(true);
  });

  it("nenhuma página, layout ou default pré-renderizado do app lê dado de requisição fora do Suspense", () => {
    const falhas: string[] = [];
    for (const f of arquivos("app", ["page.tsx", "layout.tsx", "default.tsx"])) {
      if (!rotaEhPreRenderizada(f)) continue;
      const lidas = leiturasForaDoSuspense(readFileSync(f, "utf8"));
      if (lidas.length > 0) falhas.push(relative(".", f).replaceAll("\\", "/"));
    }
    expect(falhas, "mova a leitura para um componente dentro de <Suspense>").toEqual([]);
  });
});
