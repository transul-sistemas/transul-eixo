import { describe, expect, it } from "vitest";
import { alertasDaPlaca } from "@/lib/dominio/alertas";
import { SIGLAS, SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import { CASOS_FEIOS } from "./casos-feios";
import { placasDeExemplo } from "./placas";

const HOJE = "2026-10-29";
const placas = placasDeExemplo(HOJE);

type Placa = (typeof placas)[number];
const dadosDeAlerta = (p: Placa) => ({
  tipo: p.tipo,
  modelo: p.modelo,
  sigla: p.sigla,
  desde: p.desde,
  motorista: p.motorista,
  crlvVenceEm: p.crlvVenceEm,
  crs: p.crs,
  semCavalo: p.tipo === "implemento" && p.conjunto.cavaloId === null,
});
const codigosDe = (p: Placa, hoje = HOJE) =>
  alertasDaPlaca(dadosDeAlerta(p), hoje).map((a) => a.codigo);

describe("placas de exemplo: forma", () => {
  it("são cerca de 240, com placa e id únicos, no formato AAA0A00", () => {
    expect(placas.length).toBeGreaterThanOrEqual(200);
    expect(new Set(placas.map((p) => p.placa)).size).toBe(placas.length);
    expect(new Set(placas.map((p) => p.id)).size).toBe(placas.length);
    for (const p of placas) expect(p.placa, p.placa).toMatch(/^AAA\d[A-Z]\d{2}$/);
    expect(placas[0]?.placa).toBe("AAA0A00");
  });
  it("os tipos de ativo vêm intercalados: a primeira página (25 por placa) mostra variedade", () => {
    const primeiras = [...placas].sort((a, b) => (a.placa < b.placa ? -1 : 1)).slice(0, 25);
    const tipos = new Set(primeiras.map((p) => p.tipo));
    expect(tipos.size).toBeGreaterThanOrEqual(5);
    expect(tipos).toContain("cavalo");
    expect(tipos).toContain("implemento");
    expect(tipos).toContain("caminhao");
    // e não há uma sequência longa do mesmo tipo
    let maior = 1;
    let atual = 1;
    for (let i = 1; i < primeiras.length; i++) {
      atual = primeiras[i]!.tipo === primeiras[i - 1]!.tipo ? atual + 1 : 1;
      maior = Math.max(maior, atual);
    }
    expect(maior).toBeLessThanOrEqual(3);
  });
  it("as quantidades por tipo: 60 cavalos, 100 implementos, 20 equipamentos, 30 caminhões e 30 apoios (veículo pequeno é apoio)", () => {
    const quantos = (t: string) => placas.filter((p) => p.tipo === t).length;
    expect([
      quantos("cavalo"),
      quantos("implemento"),
      quantos("equipamento"),
      quantos("caminhao"),
      quantos("apoio"),
    ]).toEqual([60, 100, 20, 30, 30]);
  });
  it("são as mesmas a cada chamada com o mesmo dia (sem sorteio)", () => {
    expect(placasDeExemplo(HOJE)).toEqual(placas);
  });
  it("as datas acompanham o dia pedido: a lista não envelhece", () => {
    const outro = "2027-02-15";
    const antes = placas.map((p) => codigosDe(p));
    const depois = placasDeExemplo(outro).map((p) => codigosDe(p, outro));
    expect(depois).toEqual(antes);
  });
  it("as 26 siglas aparecem ao menos uma vez e os 5 tipos de ativo também", () => {
    expect(new Set(placas.map((p) => p.sigla))).toEqual(new Set(SIGLAS));
    expect(new Set(placas.map((p) => p.tipo)).size).toBe(5);
    expect([...new Set(placas.map((p) => p.tipo))].sort()).toEqual(
      ["apoio", "caminhao", "cavalo", "equipamento", "implemento"].sort(),
    );
  });
  it("a composição é coerente: cada implemento ligado a um cavalo que o lista, e herda a operação", () => {
    const porId = new Map(placas.map((p) => [p.id, p]));
    for (const imp of placas.filter((p) => p.tipo === "implemento" && p.conjunto.cavaloId)) {
      const cavalo = porId.get(imp.conjunto.cavaloId as string);
      expect(cavalo?.tipo, imp.placa).toBe("cavalo");
      expect(cavalo?.conjunto.implementoIds, imp.placa).toContain(imp.id);
      expect(imp.operacao, imp.placa).toBe(cavalo?.operacao);
    }
    for (const cav of placas.filter((p) => p.tipo === "cavalo")) {
      for (const id of cav.conjunto.implementoIds) expect(porId.get(id)?.tipo).toBe("implemento");
    }
  });
  it("as vigências de CR respeitam [início, fim): fim depois do início", () => {
    for (const p of placas) {
      for (const cr of p.crs) if (cr.fim !== null) expect(cr.inicio < cr.fim, p.placa).toBe(true);
    }
  });
});

describe("placas de exemplo: casos feios, de propósito", () => {
  it("cada caso feio descrito existe", () => {
    for (const placa of Object.keys(CASOS_FEIOS)) {
      expect(
        placas.find((p) => p.placa === placa),
        placa,
      ).toBeDefined();
    }
  });
  it("nenhum caso feio é baixada: todos aparecem na lista por padrão", () => {
    for (const placa of Object.keys(CASOS_FEIOS)) {
      const achada = placas.find((p) => p.placa === placa)!;
      expect(SIGLAS_DE_BAIXA, placa).not.toContain(achada.sigla);
    }
  });
  it("há modelo A DEFINIR, CRLV vencido, cavalo sem motorista, implemento solto e CR sobreposto", () => {
    const todos = new Set(placas.flatMap((p) => codigosDe(p)));
    expect(todos).toEqual(
      new Set([
        "modelo-a-definir",
        "crlv-vencido",
        "sem-motorista",
        "implemento-solto",
        "cr-sobreposto",
      ]),
    );
  });
  it("cavalo com dois CRs em sequência e com troca de CR no mesmo dia não alertam", () => {
    const historico = placas.filter(
      (p) => p.tipo === "cavalo" && p.crs.length >= 2 && !codigosDe(p).includes("cr-sobreposto"),
    );
    expect(historico.length).toBeGreaterThanOrEqual(2);
    expect(historico.some((p) => p.crs.some((cr) => cr.fim === HOJE))).toBe(true);
  });
  it("a sobreposição de CR só acontece nos casos feios declarados", () => {
    const sobrepostos = placas
      .filter((p) => codigosDe(p).includes("cr-sobreposto"))
      .map((p) => p.placa);
    const declarados = Object.entries(CASOS_FEIOS)
      .filter(([, caso]) => caso.alerta === "cr-sobreposto")
      .map(([placa]) => placa);
    expect([...sobrepostos].sort()).toEqual([...declarados].sort());
  });
  it("há valores vazios onde a vida real tem: motorista, operação, CRLV, KM e FIPE", () => {
    expect(placas.some((p) => p.motorista === null)).toBe(true);
    expect(placas.some((p) => p.operacao === null)).toBe(true);
    expect(placas.some((p) => p.crlvVenceEm === null)).toBe(true);
    expect(placas.some((p) => p.km === null)).toBe(true);
    expect(placas.some((p) => p.valorFipeCentavos === null)).toBe(true);
    for (const p of placas) {
      if (p.valorFipeCentavos !== null) {
        expect(Number.isInteger(p.valorFipeCentavos), p.placa).toBe(true);
      }
    }
  });

  it("o ciclo de 24 placas tem 3 apoios e nenhum veículo pequeno", () => {
    const primeiras = placas.slice(0, 24);
    expect(primeiras.filter((p) => p.tipo === "apoio")).toHaveLength(3);
    expect(primeiras.map((p) => p.tipo as string)).not.toContain("veiculo-pequeno");
  });
});
