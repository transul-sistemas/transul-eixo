import { describe, expect, it } from "vitest";
import {
  filtrarLegenda,
  GRUPOS_DA_LEGENDA,
  montarLegenda,
  normalizarBusca,
} from "./legenda";
import {
  grupoDaSigla,
  NOMES_DAS_SIGLAS,
  SIGLAS,
  SIGNIFICADOS_DAS_SIGLAS,
  TONS_DE_STATUS,
  TONS_DAS_SIGLAS,
  tomDaSigla,
  variavelDoTom,
} from "./status";
import { STATUS } from "@/lib/visual/tons";

// COMPLETUDE DA RÉGUA: a legenda é gerada da régua; faltar nome, grupo, tom ou significado, ou uma sigla
// ficar fora da legenda, derruba o CI.

const FAMILIA_DO_GRUPO = {
  "em-atividade": "atividade",
  atencao: "atencao",
  impedida: "impedida",
  patio: "patio",
  fora: "fora",
} as const;

describe("a régua tem tudo o que a legenda precisa", () => {
  it.each(SIGLAS)("%s tem nome, grupo, tom e significado", (sigla) => {
    expect(NOMES_DAS_SIGLAS[sigla]?.trim(), `${sigla}: nome`).toBeTruthy();
    expect(STATUS, `${sigla}: grupo`).toContain(grupoDaSigla(sigla));
    expect(TONS_DE_STATUS, `${sigla}: tom`).toContain(TONS_DAS_SIGLAS[sigla]);
    expect(SIGNIFICADOS_DAS_SIGLAS[sigla]?.trim().length ?? 0, `${sigla}: significado`).toBeGreaterThan(
      10,
    );
  });

  it("o tom de cada sigla é da família do grupo dela", () => {
    for (const sigla of SIGLAS) {
      const familia = FAMILIA_DO_GRUPO[grupoDaSigla(sigla)];
      expect(tomDaSigla(sigla), sigla).toMatch(new RegExp(`^${familia}-[1-5]$`));
    }
  });

  it("não há tom nem significado de sigla que não existe", () => {
    expect(Object.keys(TONS_DAS_SIGLAS).sort()).toEqual([...SIGLAS].sort());
    expect(Object.keys(SIGNIFICADOS_DAS_SIGLAS).sort()).toEqual([...SIGLAS].sort());
  });

  it("os cinco tons de verde existem e cada um serve a ao menos uma sigla", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(TONS_DE_STATUS).toContain(`atividade-${n}`);
      expect(
        SIGLAS.some((s) => tomDaSigla(s) === `atividade-${n}`),
        `atividade-${n}`,
      ).toBe(true);
    }
  });

  it("todo tom da lista é usado por alguma sigla (sem tom órfão)", () => {
    for (const tom of TONS_DE_STATUS) {
      expect(
        SIGLAS.some((s) => tomDaSigla(s) === tom),
        tom,
      ).toBe(true);
    }
  });

  it("o verde fica mais escuro quanto mais perto de gerar receita", () => {
    expect(tomDaSigla("ETc")).toBe("atividade-1");
    expect(tomDaSigla("CAr")).toBe("atividade-2");
    expect(tomDaSigla("DEs")).toBe("atividade-2");
    expect(tomDaSigla("ETv")).toBe("atividade-3");
    for (const s of ["ACe", "ADe", "CAn"] as const) expect(tomDaSigla(s)).toBe("atividade-4");
    expect(tomDaSigla("DOp")).toBe("atividade-5");
  });

  it("a variável CSS do tom é só o nome do token", () => {
    expect(variavelDoTom("atividade-3")).toBe("--status-atividade-3");
  });
});

describe("a legenda gerada", () => {
  const legenda = montarLegenda();
  const todas = legenda.flatMap((g) => g.entradas);

  it("traz cada uma das 25 siglas exatamente uma vez", () => {
    expect(todas.map((e) => e.sigla).sort()).toEqual([...SIGLAS].sort());
  });

  it("os grupos da legenda são os do protótipo, na ordem, sem grupo vazio", () => {
    expect(GRUPOS_DA_LEGENDA.map((g) => g.nome)).toEqual([
      "Em operação",
      "Aguardando",
      "Operacional e pátio",
      "Manutenção e impedimentos",
      "Parado por falta de motorista",
      "Fora da frota",
    ]);
    for (const g of legenda) expect(g.entradas.length, g.nome).toBeGreaterThan(0);
  });

  it("cada entrada leva sigla, nome, significado, chip e tom da régua", () => {
    for (const e of todas) {
      expect(e.nome).toBe(NOMES_DAS_SIGLAS[e.sigla]);
      expect(e.significado).toBe(SIGNIFICADOS_DAS_SIGLAS[e.sigla]);
      expect(e.tom).toBe(TONS_DAS_SIGLAS[e.sigla]);
      expect(e.chip.length).toBeGreaterThan(0);
    }
  });

  it("DOp avisa que não é lançada no dia; as de posse avisam que nascem da posse e da baixa", () => {
    const aviso = (s: string) => todas.find((e) => e.sigla === s)?.aviso ?? "";
    expect(aviso("DOp")).toContain("nasce da entrega ao Operacional");
    for (const s of ["ALU", "EMP", "VEN", "SUC", "VND"]) {
      expect(aviso(s)).toContain("posse e da baixa");
    }
  });
});

describe("a busca da legenda", () => {
  const legenda = montarLegenda();
  const siglasDe = (busca: string) =>
    filtrarLegenda(legenda, busca).flatMap((g) => g.entradas.map((e) => e.sigla));

  it("busca vazia devolve tudo", () => {
    expect(siglasDe("").length).toBe(25);
    expect(siglasDe("   ").length).toBe(25);
  });
  it("acha pela sigla, sem diferenciar maiúscula nem acento", () => {
    expect(siglasDe("ace")).toContain("ACe");
    expect(siglasDe("pat")).toContain("PÁT");
    expect(siglasDe("PÁT")).toContain("PÁT");
  });
  it("acha pela palavra do nome ou do significado", () => {
    expect(siglasDe("folga")).toContain("FOg");
    expect(siglasDe("ferias")).toContain("FEr");
    expect(siglasDe("sucata")).toContain("SUC");
  });
  it("sem resultado devolve vazio e some o grupo vazio", () => {
    expect(filtrarLegenda(legenda, "xyz")).toEqual([]);
  });
  it("só mostra os grupos que têm resultado", () => {
    const grupos = filtrarLegenda(legenda, "vendido").map((g) => g.nome);
    expect(grupos).toEqual(["Fora da frota"]);
  });
  it("normalizarBusca tira acento, caixa e espaços das pontas", () => {
    expect(normalizarBusca("  PÁT Férias ")).toBe("pat ferias");
  });
});
