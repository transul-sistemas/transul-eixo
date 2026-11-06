import { describe, expect, it } from "vitest";
import { esquemaCadastrarPlaca } from "@/lib/dominio/esquemas/placa";
import { paraEntradaDoCadastro } from "./entradas-dos-assistentes";

const cadastroDaTela = {
  placa: "zzz-9z99",
  renavam: "00639884962",
  tipo: "cavalo",
  marcaId: "marca-volvo",
  modeloId: "modelo-fh-540",
  ano: "2022",
  funcao: "",
  carroceriaId: "",
  eixos: "",
  codigoFipe: "509035-0",
  valorFipeCentavos: 78_500_000,
  valorManualCentavos: 0,
  fonteDoValor: "",
  dataDoValor: "",
  gestorId: "gestor-1",
  operacaoId: "op-1",
  crId: "cr-1001",
  situacaoInicial: "PÁT",
};
const esquema = esquemaCadastrarPlaca({ anoAtual: 2026, hoje: "2026-10-31" });

describe("paraEntradaDoCadastro: o que a tela digita vira o que o esquema espera", () => {
  it("o ano digitado vira número e o cadastro vale", () => {
    const entrada = paraEntradaDoCadastro(cadastroDaTela);
    expect(entrada.ano).toBe(2022);
    expect(esquema.safeParse(entrada).success).toBe(true);
  });

  it("sem operação ou sem CR, o esquema pede o campo (são obrigatórios)", () => {
    const r = esquema.safeParse(
      paraEntradaDoCadastro({ ...cadastroDaTela, operacaoId: "", crId: "" }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path.join("."));
      expect(campos).toContain("operacaoId");
      expect(campos).toContain("crId");
    }
  });

  it("ano vazio (texto vazio, NaN ou ausente) não é um número: o esquema pede o ano", () => {
    for (const ano of ["", Number.NaN, undefined, null]) {
      const r = esquema.safeParse(paraEntradaDoCadastro({ ...cadastroDaTela, ano }));
      expect(r.success, String(ano)).toBe(false);
      if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("ano");
    }
  });

  it("implemento: os eixos digitados viram número e a carroceria vazia vira nula", () => {
    const implemento = {
      ...cadastroDaTela,
      tipo: "implemento",
      funcao: "semirreboque",
      carroceriaId: "carroceria-sider",
      eixos: "3",
      valorManualCentavos: 2_500_000,
      fonteDoValor: "Nota fiscal",
      dataDoValor: "2026-09-10",
    };
    const entrada = paraEntradaDoCadastro(implemento);
    expect(entrada.eixos).toBe(3);
    expect(esquema.safeParse(entrada).success).toBe(true);
    const dolly = paraEntradaDoCadastro({
      ...implemento,
      funcao: "dolly",
      carroceriaId: "",
      eixos: "",
    });
    expect(dolly.carroceriaId).toBeNull();
    expect(dolly.eixos).toBeNull();
    expect(esquema.safeParse(dolly).success).toBe(true);
  });

  it("tipo ainda não escolhido (vazio) pede o tipo, em vez de quebrar", () => {
    const r = esquema.safeParse(paraEntradaDoCadastro({ ...cadastroDaTela, tipo: "" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toContain("tipo");
  });

  it("não muda o objeto de entrada", () => {
    const copia = structuredClone(cadastroDaTela);
    paraEntradaDoCadastro(cadastroDaTela);
    expect(cadastroDaTela).toEqual(copia);
  });
});
