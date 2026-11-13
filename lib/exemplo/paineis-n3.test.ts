import { beforeEach, describe, expect, it } from "vitest";
import { gravarPainelDeExemplo, lerPainelDeExemplo, zerarPaineisDeExemplo } from "./paineis";
import { PESSOAS_DOS_PROCESSOS } from "./paineis-n3";

const HOJE = "2026-11-13";
const ESTADO = { mes: null, filtro: null, busca: "", pagina: 1, tam: 100 };

interface Leitura {
  tabela: {
    total: number;
    linhas: { id: string; celulas: Record<string, unknown>; acoes?: { assistente: string }[] }[];
  };
  chips: { id: string; contagem: number }[];
  avisos: string[];
}

const ler = (id: string, estado = ESTADO) => lerPainelDeExemplo(id, estado, HOJE) as Leitura;

describe("exemplo do N3: processos", () => {
  beforeEach(() => zerarPaineisDeExemplo());

  it("o Painel de processos lista as tarefas abertas, cada uma com Reatribuir", () => {
    const l = ler("admin.painel-de-processos");
    expect(l.tabela.total).toBeGreaterThan(20);
    expect(l.tabela.linhas.every((x) => x.acoes?.[0]?.assistente === "reatribuir-tarefa")).toBe(
      true,
    );
    const somaDosChips = l.chips
      .filter((c) => c.id !== "todos")
      .reduce((a, c) => a + c.contagem, 0);
    expect(somaDosChips).toBe(l.tabela.total);
  });

  it("reatribuir troca o dono; a mesma chave grava uma vez só", () => {
    const antes = ler("admin.painel-de-processos").tabela.linhas[0]!;
    const novo = PESSOAS_DOS_PROCESSOS.find((p) => p.nome === "Gestor Demo 05")!;
    const dados = { tarefa: `${antes.id}:1`, pessoaId: novo.id, motivo: "Férias do dono atual" };
    expect(gravarPainelDeExemplo("reatribuir-tarefa", dados, "c1", HOJE).ok).toBe(true);
    expect(gravarPainelDeExemplo("reatribuir-tarefa", dados, "c1", HOJE).ok).toBe(true);
    const depois = ler("admin.painel-de-processos").tabela.linhas.find((x) => x.id === antes.id)!;
    expect(depois.celulas.dono).toBe("Gestor Demo 05");
  });

  it("delegar cobre a pessoa no período [início, fim) e recusa período sobreposto", () => {
    const de = PESSOAS_DOS_PROCESSOS.find((p) => p.nome === "Gestor Demo 01")!;
    const para = PESSOAS_DOS_PROCESSOS.find((p) => p.nome === "Gestor Demo 03")!;
    const base = { deId: de.id, paraId: para.id, motivo: "Férias" };
    expect(
      gravarPainelDeExemplo(
        "delegar-tarefas",
        { ...base, inicio: HOJE, fim: "2026-11-20" },
        "d1",
        HOJE,
      ).ok,
    ).toBe(true);
    const r = gravarPainelDeExemplo(
      "delegar-tarefas",
      { ...base, inicio: "2026-11-19", fim: "2026-11-25" },
      "d2",
      HOJE,
    );
    expect(r.ok).toBe(false);
    const matriz = ler("admin.processos");
    expect(matriz.tabela.linhas.some((x) => x.celulas.substituto === "Gestor Demo 03")).toBe(true);
    expect(matriz.avisos[0]).toMatch(/Gestor Demo 03 cobre Gestor Demo 01/);
  });
});
