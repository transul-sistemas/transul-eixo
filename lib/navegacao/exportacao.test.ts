import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPORTADORES_PROPRIOS } from "@/lib/exportacao/exportadores";
import { todasAsTelas } from "./catalogo";
import {
  enderecoDoCsv,
  LISTAS_DE_PAINEL,
  LISTAS_PROPRIAS,
  nomeDoArquivoCsv,
  TELAS_SEM_LISTA,
} from "./exportacao";

// Exportar CSV em TODAS as listas (Fase 1, N3): toda tela do catálogo é lista (com o botão e o
// exportador) ou está registrada como "não é lista", com o motivo.

/** O texto de todos os .tsx da pasta da tela (sem as fichas `[...]` nem os testes). */
function textoDaPasta(rota: string): string {
  const pasta = join("app/(sistema)", rota);
  return readdirSync(pasta, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name))
    .map((e) => readFileSync(join(pasta, e.name), "utf8"))
    .join("\n");
}

describe("Exportar CSV", () => {
  const telas = todasAsTelas();

  it("toda tela do catálogo é lista ou está registrada como não lista, uma vez só", () => {
    const listas = [...LISTAS_DE_PAINEL, ...LISTAS_PROPRIAS] as string[];
    for (const t of telas) {
      const vezes = listas.filter((id) => id === t.id).length + (t.id in TELAS_SEM_LISTA ? 1 : 0);
      expect(vezes, t.id).toBe(1);
    }
    const ids = telas.map((t) => t.id);
    for (const id of [...listas, ...Object.keys(TELAS_SEM_LISTA)]) expect(ids, id).toContain(id);
  });

  it("toda lista tem o botão na barra de consulta", () => {
    for (const id of LISTAS_DE_PAINEL) {
      const tela = telas.find((t) => t.id === id)!;
      expect(textoDaPasta(tela.rota), id).toMatch(/TelaDePainel\b/);
    }
    for (const id of LISTAS_PROPRIAS) {
      const tela = telas.find((t) => t.id === id)!;
      const texto = textoDaPasta(tela.rota);
      expect(texto, id).toMatch(/exportar=\{enderecoDoCsv\(|Exportar CSV/);
    }
    // A tela de painel liga o botão para toda tela que é lista.
    const painel = readFileSync("components/paineis/tela-de-painel.tsx", "utf8");
    expect(painel).toMatch(/exportar=\{ehLista\(idDaTela\)/);
  });

  it("toda lista própria tem o exportador no servidor", () => {
    expect([...EXPORTADORES_PROPRIOS].sort()).toEqual([...LISTAS_PROPRIAS].sort());
  });

  it("o endereço leva os filtros e deixa de fora página, tamanho, painel e assistente", () => {
    const p = new URLSearchParams(
      "mes=2026-10&filtro=atencao&busca=zdm&pagina=3&tam=50&espiar=ZDM1A11&assistente=x",
    );
    expect(enderecoDoCsv("resultados.ajustes", p)).toBe(
      "/exportar/resultados.ajustes?mes=2026-10&filtro=atencao&busca=zdm",
    );
    expect(enderecoDoCsv("inicio.tarefas")).toBe("/exportar/inicio.tarefas");
    expect(enderecoDoCsv("frota.excecoes", new URLSearchParams("assunto=x&pagina=2"))).toBe(
      "/frota/excecoes/csv?assunto=x",
    );
  });

  it("o nome do arquivo é a tela e o dia", () => {
    expect(nomeDoArquivoCsv("frota.placas", "2026-11-13")).toBe("frota-placas-2026-11-13.csv");
  });
});
