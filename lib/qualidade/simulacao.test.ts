import { describe, expect, it } from "vitest";
import { lerTexto, listarArquivos } from "./armadilhas";

// ?lento e ?falha existem só para testar os estados da tela com os dados de exemplo. Quem os
// obedece é a fonte de exemplo; as demais camadas só repassam a opção.

const PODEM_CITAR = [
  "lib/dados/fonte-de-exemplo.ts",
  "lib/dados/placas-tipos.ts",
  "app/(sistema)/frota/placas/pagina-de-placas.tsx",
  "lib/qualidade/simulacao.test.ts",
  "docs/",
];

describe("simulação de lentidão e falha", () => {
  it("só a fonte de exemplo age sobre lentoMs; ninguém mais usa o valor", () => {
    const arquivos = ["app", "components", "lib"]
      .flatMap((pasta) => listarArquivos(pasta, /\.(ts|tsx)$/))
      .filter((c) => !c.endsWith(".test.ts") && !c.endsWith(".test.tsx"))
      .filter((c) => lerTexto(c).includes("lentoMs"))
      .filter((c) => !PODEM_CITAR.some((permitido) => c.startsWith(permitido) || c === permitido));
    expect(arquivos).toEqual([]);
  });
  it("dentro da fonte de exemplo, a simulação vem depois da conferência de EIXO_DADOS", () => {
    const texto = lerTexto("lib/dados/fonte-de-exemplo.ts");
    expect(texto.indexOf("MENSAGEM_SO_COM_EXEMPLO")).toBeGreaterThan(-1);
    expect(texto.indexOf("MENSAGEM_SO_COM_EXEMPLO", texto.indexOf("async consultar"))).toBeLessThan(
      texto.indexOf("lentoMs", texto.indexOf("async consultar")),
    );
  });
});
