import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIPOS_DE_ATIVO, type TipoDeAtivo } from "@/lib/dados/placas-tipos";
import {
  CAMADAS_DE_STATUS,
  ehBaixada,
  grupoDaSigla,
  NOMES_DAS_SIGLAS,
  REGRAS_DAS_SIGLAS,
  siglaAceitaOTipo,
  SIGLAS,
  SIGLAS_DE_BAIXA,
  type Sigla,
} from "./status";

// A régua do CLAUDE.md, copiada aqui de propósito: se alguém mexer na régua, o teste acusa.
const REGUA_DO_CLAUDE = [
  "ETc",
  "ETv",
  "CAr",
  "DEs",
  "DOp",
  "ACe",
  "ADe",
  "CAn",
  "MAc",
  "MAt",
  "MAv",
  "MAN",
  "REF",
  "SIN",
  "FOg",
  "FEr",
  "SMo",
  "SDo",
  "PÁT",
  "DOC",
  "ALU",
  "EMP",
  "VEN",
  "SUC",
  "VND",
];

// Tabela aprovada por Alexandre (29/10/2026).
const TABELA = {
  "em-atividade": ["DOp", "ACe", "CAr", "CAn", "ETc", "ADe", "DEs", "ETv"],
  impedida: ["MAc", "MAt", "MAv", "MAN", "REF", "SIN", "SDo", "DOC"],
  atencao: ["SMo", "FOg", "FEr"],
  patio: ["PÁT"],
  fora: ["ALU", "EMP", "VEN", "SUC", "VND"],
} as const;

const NOMES = {
  DOp: "Disponível no Operacional",
  ACe: "Aguardando carregamento",
  CAr: "Carregando",
  CAn: "Carregado aguardando nota",
  ETc: "Em trânsito carregado",
  ADe: "Aguardando descarga",
  DEs: "Descarregando",
  ETv: "Em trânsito vazio",
  MAc: "Manutenção / carregado",
  MAt: "Manutenção / tombado",
  MAv: "Manutenção / vazio",
  MAN: "Em manutenção",
  REF: "Em reforma",
  SIN: "Sinistro",
  FOg: "Folga",
  FEr: "Férias",
  SMo: "Sem motorista",
  SDo: "Sem documento",
  PÁT: "Pátio",
  DOC: "Problema documental",
  ALU: "Alugado a terceiro",
  EMP: "Emprestado",
  VEN: "Disponível para venda",
  SUC: "Sucata",
  VND: "Vendido",
} as const;

describe("siglas e chips", () => {
  it("as 25 siglas são exatamente as da régua do CLAUDE.md (VAz saiu em 05/11/2026)", () => {
    expect([...SIGLAS].sort()).toEqual([...REGUA_DO_CLAUDE].sort());
    expect(SIGLAS).toHaveLength(25);
    expect(SIGLAS).not.toContain("VAz");
  });
  it("cada sigla cai em exatamente um chip, o aprovado", () => {
    for (const [grupo, siglas] of Object.entries(TABELA)) {
      for (const sigla of siglas) expect(grupoDaSigla(sigla), sigla).toBe(grupo);
    }
    expect(Object.values(TABELA).flat()).toHaveLength(25);
  });
  it("Em atividade tem 8, Impedida 8, Atenção 3 (SMo, FOg e FEr), Pátio 1 e Fora 5", () => {
    const quantas = (g: string) => SIGLAS.filter((s) => grupoDaSigla(s) === g).length;
    expect([
      quantas("em-atividade"),
      quantas("impedida"),
      quantas("atencao"),
      quantas("patio"),
      quantas("fora"),
    ]).toEqual([8, 8, 3, 1, 5]);
  });
  it("PÁT mantém o acento", () => {
    expect(SIGLAS).toContain("PÁT");
    expect(grupoDaSigla("PÁT")).toBe("patio");
  });
  it("só VND e SUC são baixadas", () => {
    expect([...SIGLAS_DE_BAIXA].sort()).toEqual(["SUC", "VND"]);
    expect(SIGLAS.filter(ehBaixada).sort()).toEqual(["SUC", "VND"]);
  });
});

describe("nomes por extenso", () => {
  it("são exatamente os aprovados", () => {
    expect(NOMES_DAS_SIGLAS).toEqual(NOMES);
  });
  it("o glossário traz cada sigla com o mesmo nome", () => {
    const glossario = readFileSync("docs/glossario.md", "utf-8");
    for (const [sigla, nome] of Object.entries(NOMES)) {
      expect(glossario, sigla).toContain(`| ${sigla} | ${nome} |`);
    }
  });
});

describe("a régua em camadas (Apêndice A, aprovado em 31/10/2026)", () => {
  const regra = (sigla: Sigla) => REGRAS_DAS_SIGLAS[sigla];
  const todos = [...TIPOS_DE_ATIVO];
  const comTipos = (...tipos: TipoDeAtivo[]) => [...tipos].sort();
  const ordenados = (tipos: readonly TipoDeAtivo[]) => [...tipos].sort();

  it("toda sigla tem camada, aplica_a e ao menos um tipo válido", () => {
    for (const sigla of SIGLAS) {
      expect(CAMADAS_DE_STATUS, sigla).toContain(regra(sigla).camada);
      expect(["conjunto", "solo", "ambos"], sigla).toContain(regra(sigla).aplicaA);
      expect(regra(sigla).tiposValidos.length, sigla).toBeGreaterThan(0);
    }
  });

  it("são cinco camadas, da que vence à que perde", () => {
    expect(CAMADAS_DE_STATUS).toEqual([
      "baixada",
      "fora-da-frota",
      "impedida",
      "sem-motorista",
      "atividade",
    ]);
  });

  it("a camada de cada sigla", () => {
    const por = (camada: string) => SIGLAS.filter((s) => regra(s).camada === camada).sort();
    expect(por("baixada")).toEqual(["SUC", "VND"].sort());
    expect(por("fora-da-frota")).toEqual(["ALU", "EMP", "VEN"].sort());
    expect(por("impedida")).toEqual(
      ["DOC", "MAN", "MAc", "MAt", "MAv", "REF", "SDo", "SIN"].sort(),
    );
    expect(por("sem-motorista")).toEqual(["FEr", "FOg", "SMo"].sort());
    expect(por("atividade")).toEqual(
      ["ACe", "ADe", "CAn", "CAr", "DEs", "DOp", "ETc", "ETv", "PÁT"].sort(),
    );
  });

  it("DOp, ETv e SMo valem para composição, caminhão e cavalo sozinho: ambos, cavalo e caminhão", () => {
    for (const sigla of ["DOp", "ETv", "SMo"] as const) {
      expect(regra(sigla).aplicaA, sigla).toBe("ambos");
      expect(ordenados(regra(sigla).tiposValidos), sigla).toEqual(comTipos("cavalo", "caminhao"));
    }
  });

  it("ACe, CAr, CAn, ETc, ADe e DEs: só conjunto com implemento e caminhão", () => {
    for (const sigla of ["ACe", "CAr", "CAn", "ETc", "ADe", "DEs"] as const) {
      expect(regra(sigla).aplicaA, sigla).toBe("conjunto");
      expect(ordenados(regra(sigla).tiposValidos), sigla).toEqual(comTipos("cavalo", "caminhao"));
    }
  });

  it("implemento sozinho nunca entra em etapa de operação", () => {
    for (const sigla of ["DOp", "ACe", "CAr", "CAn", "ETc", "ADe", "DEs", "ETv"] as const) {
      expect(siglaAceitaOTipo(sigla, "implemento"), sigla).toBe(false);
    }
  });

  it("MAc, MAt e MAv são só de conjunto (cavalo e implemento); MAN e SIN são de solo", () => {
    for (const sigla of ["MAc", "MAt", "MAv"] as const) {
      expect(regra(sigla).aplicaA, sigla).toBe("conjunto");
      expect(ordenados(regra(sigla).tiposValidos), sigla).toEqual(comTipos("cavalo", "implemento"));
    }
    for (const sigla of ["MAN", "SIN"] as const) {
      expect(regra(sigla).aplicaA, sigla).toBe("solo");
      expect(ordenados(regra(sigla).tiposValidos), sigla).toEqual(comTipos(...todos));
    }
  });

  it("SDo e DOC valem para ambos; PÁT vale para ambos e cobre qualquer ativo parado (o VAz saiu)", () => {
    for (const sigla of ["SDo", "DOC"] as const) expect(regra(sigla).aplicaA, sigla).toBe("ambos");
    expect(Object.keys(REGRAS_DAS_SIGLAS)).not.toContain("VAz");
    expect(regra("PÁT").aplicaA).toBe("ambos");
    expect(ordenados(regra("PÁT").tiposValidos)).toEqual(comTipos(...todos));
  });

  it("FOg e FEr ficam na camada sem motorista, com cavalo e caminhão como SMo", () => {
    for (const sigla of ["FOg", "FEr"] as const) {
      expect(regra(sigla).camada, sigla).toBe("sem-motorista");
      expect(ordenados(regra(sigla).tiposValidos), sigla).toEqual(comTipos("cavalo", "caminhao"));
    }
  });

  it("siglaAceitaOTipo responde pela lista de tipos válidos", () => {
    expect(siglaAceitaOTipo("DOp", "cavalo")).toBe(true);
    expect(siglaAceitaOTipo("DOp", "caminhao")).toBe(true);
    expect(siglaAceitaOTipo("DOp", "apoio")).toBe(false);
    expect(siglaAceitaOTipo("DOp", "equipamento")).toBe(false);
    expect(siglaAceitaOTipo("PÁT", "implemento")).toBe(true);
  });
});
