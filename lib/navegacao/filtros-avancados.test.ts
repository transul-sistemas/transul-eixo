import { describe, expect, it } from "vitest";
import { NOMES_DAS_SIGLAS, SIGLAS } from "@/lib/dominio/status";
import {
  alternarSigla,
  contarFiltrosAvancados,
  dicaDoChipDeSituacao,
  gruposDeSiglas,
  rotuloDaSigla,
} from "./filtros-avancados";

describe("gruposDeSiglas: as 25 siglas agrupadas pelo chip de origem", () => {
  const grupos = gruposDeSiglas();

  it("os cinco chips, na ordem em que aparecem na barra", () => {
    expect(grupos.map((g) => g.nome)).toEqual([
      "Em atividade",
      "Atenção",
      "Impedida",
      "Pátio",
      "Fora",
    ]);
    expect(grupos.map((g) => g.id)).toEqual([
      "em-atividade",
      "atencao",
      "impedida",
      "patio",
      "fora",
    ]);
  });
  it("cobrem exatamente as 25 siglas, cada uma uma vez", () => {
    const todas = grupos.flatMap((g) => g.siglas.map((s) => s.sigla));
    expect([...todas].sort()).toEqual([...SIGLAS].sort());
    expect(new Set(todas).size).toBe(25);
  });
  it("cada sigla traz o nome por extenso do glossário", () => {
    for (const grupo of grupos) {
      for (const item of grupo.siglas) expect(item.nome).toBe(NOMES_DAS_SIGLAS[item.sigla]);
    }
  });
  it("as quantidades por grupo são 8, 3, 8, 1 e 5 (Atenção: SMo, FOg e FEr)", () => {
    expect(grupos.map((g) => g.siglas.length)).toEqual([8, 3, 8, 1, 5]);
  });
  it("marca VND e SUC como baixadas, e só elas", () => {
    const baixadas = grupos
      .flatMap((g) => g.siglas)
      .filter((s) => s.baixada)
      .map((s) => s.sigla);
    expect(baixadas.sort()).toEqual(["SUC", "VND"]);
  });
  it("dentro de cada grupo mantém a ordem da régua do CLAUDE.md", () => {
    const naRegua = (g: string) => grupos.find((x) => x.id === g)!.siglas.map((s) => s.sigla);
    expect(naRegua("em-atividade")).toEqual([
      "ETc",
      "ETv",
      "CAr",
      "DEs",
      "DOp",
      "ACe",
      "ADe",
      "CAn",
    ]);
    expect(naRegua("fora")).toEqual(["ALU", "EMP", "VEN", "SUC", "VND"]);
  });
});

describe("rotuloDaSigla", () => {
  it("junta a sigla exata e o nome, sem trocar o acento", () => {
    expect(rotuloDaSigla("PÁT")).toBe("PÁT Pátio");
    expect(rotuloDaSigla("DOp")).toBe("DOp Disponível no Operacional");
    expect(rotuloDaSigla("MAc")).toBe("MAc Manutenção / carregado");
  });
});

describe("dicaDoChipDeSituacao (o tooltip do chip)", () => {
  it("lista as siglas do grupo com o nome por extenso", () => {
    const dica = dicaDoChipDeSituacao("patio");
    expect(dica).toContain("PÁT Pátio");
    const fora = dicaDoChipDeSituacao("fora");
    expect(fora).toContain("VND Vendido");
    expect(fora).toContain("SUC Sucata");
  });
  it("avisa que VND e SUC só entram com 'inclui baixadas'", () => {
    expect(dicaDoChipDeSituacao("fora")).toMatch(/baixadas/i);
    expect(dicaDoChipDeSituacao("patio")).not.toMatch(/baixadas/i);
  });
  it("todo chip de situação tem dica", () => {
    for (const id of ["em-atividade", "atencao", "impedida", "patio", "fora"] as const) {
      expect(dicaDoChipDeSituacao(id).length).toBeGreaterThan(10);
    }
  });
});

describe("alternarSigla", () => {
  it("liga e desliga, sem repetir", () => {
    expect(alternarSigla([], "PÁT")).toEqual(["PÁT"]);
    expect(alternarSigla(["PÁT"], "DOp")).toEqual(["PÁT", "DOp"]);
    expect(alternarSigla(["PÁT", "DOp"], "PÁT")).toEqual(["DOp"]);
  });
});

describe("contarFiltrosAvancados (o número no botão Mais filtros)", () => {
  it("conta as siglas e o 'inclui baixadas'", () => {
    expect(contarFiltrosAvancados({ siglas: [], baixadas: false })).toBe(0);
    expect(contarFiltrosAvancados({ siglas: ["PÁT"], baixadas: false })).toBe(1);
    expect(contarFiltrosAvancados({ siglas: ["PÁT", "DOp"], baixadas: true })).toBe(3);
    expect(contarFiltrosAvancados({ siglas: [], baixadas: true })).toBe(1);
  });
});
