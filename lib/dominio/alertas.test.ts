import { describe, expect, it } from "vitest";
import { alertasDaPlaca, type DadosParaAlertas } from "./alertas";

const HOJE = "2026-10-29";

const base: DadosParaAlertas = {
  tipo: "cavalo",
  modelo: "FH 540",
  sigla: "ETc",
  desde: "2026-10-20T08:00",
  motorista: "Fulano de Tal",
  crlvVenceEm: "2027-03-01",
  crs: [{ inicio: "2026-01-01", fim: null }],
  semCavalo: false,
};
const codigos = (d: Partial<DadosParaAlertas>) =>
  alertasDaPlaca({ ...base, ...d }, HOJE).map((a) => a.codigo);

describe("alertasDaPlaca", () => {
  it("placa em ordem não tem alerta", () => {
    expect(alertasDaPlaca(base, HOJE)).toEqual([]);
  });
  it("modelo A DEFINIR alerta, em qualquer caixa", () => {
    expect(codigos({ modelo: "A DEFINIR" })).toEqual(["modelo-a-definir"]);
    expect(codigos({ modelo: "a definir" })).toEqual(["modelo-a-definir"]);
  });
  it("CRLV que vence hoje ainda vale; o de ontem alerta", () => {
    expect(codigos({ crlvVenceEm: "2026-10-29" })).toEqual([]);
    expect(codigos({ crlvVenceEm: "2026-10-28" })).toEqual(["crlv-vencido"]);
  });
  it("sem data de CRLV não alerta", () => {
    expect(codigos({ crlvVenceEm: null })).toEqual([]);
  });
  it("cavalo em atividade sem motorista alerta; fora de atividade, não", () => {
    expect(codigos({ motorista: null })).toEqual(["sem-motorista"]);
    expect(codigos({ motorista: null, sigla: "MAN" })).toEqual([]);
    expect(codigos({ motorista: null, tipo: "implemento", semCavalo: false })).toEqual([]);
  });
  it("implemento sem cavalo há 30 dias não alerta; há 31, alerta", () => {
    const solto = { tipo: "implemento", semCavalo: true, motorista: null } as const;
    expect(codigos({ ...solto, desde: "2026-09-29T00:00" })).toEqual([]);
    expect(codigos({ ...solto, desde: "2026-09-28T23:59" })).toEqual(["implemento-solto"]);
  });
  it("implemento com cavalo nunca é solto", () => {
    expect(
      codigos({ tipo: "implemento", semCavalo: false, desde: "2025-01-01T00:00", motorista: null }),
    ).toEqual([]);
  });
  it("dois CRs vigentes hoje alertam", () => {
    expect(
      codigos({
        crs: [
          { inicio: "2026-01-01", fim: null },
          { inicio: "2026-09-01", fim: null },
        ],
      }),
    ).toEqual(["cr-sobreposto"]);
  });
  it("um CR que termina hoje e outro que começa hoje não se sobrepõem ([início, fim))", () => {
    expect(
      codigos({
        crs: [
          { inicio: "2026-01-01", fim: "2026-10-29" },
          { inicio: "2026-10-29", fim: null },
        ],
      }),
    ).toEqual([]);
  });
  it("CR já encerrado não conta", () => {
    expect(
      codigos({
        crs: [
          { inicio: "2025-01-01", fim: "2026-01-01" },
          { inicio: "2026-01-01", fim: null },
        ],
      }),
    ).toEqual([]);
  });
  it("acumula vários alertas, com texto para a tela", () => {
    const alertas = alertasDaPlaca(
      { ...base, modelo: "A DEFINIR", crlvVenceEm: "2026-01-01" },
      HOJE,
    );
    expect(alertas.map((a) => a.codigo)).toEqual(["modelo-a-definir", "crlv-vencido"]);
    expect(alertas.every((a) => a.texto.length > 0)).toBe(true);
  });
});
