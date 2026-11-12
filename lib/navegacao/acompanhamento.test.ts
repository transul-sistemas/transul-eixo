import { describe, expect, it } from "vitest";
import {
  enderecoDoAcompanhamento,
  enderecoDaCarteira,
  lerAcompanhamento,
  lerCarteira,
  mesVizinho,
  siglasParaLancar,
} from "./acompanhamento";

const HOJE = "2026-11-09";
const p = (texto: string) => new URLSearchParams(texto);

describe("estado do Acompanhamento na URL", () => {
  it("o tamanho da página: 20 por padrão, o lembrado, e a URL vale mais; valor fora de 20/50/100 é ignorado", () => {
    expect(lerAcompanhamento(p(""), HOJE).tam).toBe(20);
    expect(lerAcompanhamento(p(""), HOJE, 50).tam).toBe(50);
    expect(lerAcompanhamento(p("tam=100"), HOJE, 50).tam).toBe(100);
    expect(lerAcompanhamento(p("tam=7"), HOJE, 50).tam).toBe(50);
    expect(lerAcompanhamento(p("tam=100000"), HOJE).tam).toBe(20);
    const e = lerAcompanhamento(p("tam=50&pagina=2"), HOJE);
    expect(enderecoDoAcompanhamento(e, HOJE)).toBe("/frota/acompanhamento?pagina=2&tam=50");
  });

  it("sem nada, abre a grade do mês de hoje, página 1", () => {
    expect(lerAcompanhamento(p(""), HOJE)).toEqual({
      modo: "grade",
      mes: "2026-11",
      dia: HOJE,
      agrupamento: "operacao",
      busca: "",
      tipo: null,
      grupo: null,
      tipoDeCr: null,
      pagina: 1,
      foraPagina: 1,
      tam: 20,
    });
  });

  it("lê modo, mês, dia, agrupamento, busca, tipo e página", () => {
    expect(
      lerAcompanhamento(
        p("modo=censo&mes=2026-01&dia=2026-01-16&por=gestor&busca=abc&tipo=cavalo&pagina=3"),
        HOJE,
      ),
    ).toEqual({
      modo: "censo",
      mes: "2026-01",
      dia: "2026-01-16",
      agrupamento: "gestor",
      busca: "abc",
      tipo: "cavalo",
      grupo: null,
      tipoDeCr: null,
      pagina: 3,
      foraPagina: 1,
      tam: 20,
    });
  });

  it('os chips da grade, o tipo de CR e a página de "fora de conjunto" ficam na URL (ida e volta)', () => {
    const e = lerAcompanhamento(p("chip=impedida&cr=acionista&fora=3&pagina=2"), HOJE);
    expect(e).toMatchObject({ grupo: "impedida", tipoDeCr: "acionista", foraPagina: 3, pagina: 2 });
    expect(enderecoDoAcompanhamento(e, HOJE)).toBe(
      "/frota/acompanhamento?chip=impedida&cr=acionista&pagina=2&fora=3",
    );
    expect(lerAcompanhamento(p("chip=azul&cr=terceiro&fora=-1"), HOJE)).toMatchObject({
      grupo: null,
      tipoDeCr: null,
      foraPagina: 1,
    });
  });

  it("valor inválido volta ao padrão; mês e dia futuros voltam a hoje", () => {
    const e = lerAcompanhamento(
      p("modo=xis&mes=2027-01&dia=2026-12-01&por=cor&tipo=nave&pagina=-2"),
      HOJE,
    );
    expect(e).toMatchObject({
      modo: "grade",
      mes: "2026-11",
      dia: HOJE,
      agrupamento: "operacao",
      tipo: null,
      pagina: 1,
    });
  });

  it("escreve só o que difere do padrão (ida e volta)", () => {
    const e = lerAcompanhamento(p("modo=agora&por=tipo"), HOJE);
    expect(enderecoDoAcompanhamento(e, HOJE)).toBe("/frota/acompanhamento?modo=agora&por=tipo");
    expect(enderecoDoAcompanhamento(lerAcompanhamento(p(""), HOJE), HOJE)).toBe(
      "/frota/acompanhamento",
    );
    const volta = lerAcompanhamento(
      new URLSearchParams(
        enderecoDoAcompanhamento({ ...e, modo: "grade", mes: "2026-01", pagina: 2 }, HOJE).split(
          "?",
        )[1],
      ),
      HOJE,
    );
    expect(volta).toMatchObject({ modo: "grade", mes: "2026-01", pagina: 2, agrupamento: "tipo" });
  });

  it("mês vizinho atravessa o ano", () => {
    expect(mesVizinho("2026-01", -1)).toBe("2025-12");
    expect(mesVizinho("2026-12", 1)).toBe("2027-01");
  });
});

describe("estado da Carteira na URL", () => {
  it("20 linhas por padrão; o tamanho lembrado e o da URL (20, 50 ou 100) valem", () => {
    expect(lerCarteira(p(""), HOJE).tam).toBe(20);
    expect(lerCarteira(p(""), HOJE, 50).tam).toBe(50);
    expect(lerCarteira(p("tam=100"), HOJE, 50).tam).toBe(100);
    expect(lerCarteira(p("tam=33"), HOJE).tam).toBe(20);
    expect(enderecoDaCarteira(lerCarteira(p("tam=50"), HOJE), HOJE)).toBe("/frota/carteira?tam=50");
  });

  it("padrão: mês de hoje, todas, página 1", () => {
    expect(lerCarteira(p(""), HOJE)).toEqual({
      mes: "2026-11",
      filtro: "todas",
      pagina: 1,
      tam: 20,
    });
    expect(enderecoDaCarteira(lerCarteira(p(""), HOJE), HOJE)).toBe("/frota/carteira");
  });

  it("lê e escreve mês, filtro e página; mês futuro volta a hoje", () => {
    const e = lerCarteira(p("mes=2026-10&filtro=pendentes&pagina=2"), HOJE);
    expect(e).toEqual({ mes: "2026-10", filtro: "pendentes", pagina: 2, tam: 20 });
    expect(enderecoDaCarteira(e, HOJE)).toBe(
      "/frota/carteira?mes=2026-10&filtro=pendentes&pagina=2",
    );
    expect(lerCarteira(p("mes=2026-12&filtro=xx"), HOJE)).toMatchObject({
      mes: "2026-11",
      filtro: "todas",
    });
  });
});

describe("siglas que a grade oferece", () => {
  it("cavalo solto: sem as de conjunto e sem as de baixa", () => {
    const siglas = siglasParaLancar("cavalo", false);
    expect(siglas).toContain("PÁT");
    expect(siglas).toContain("DOp");
    expect(siglas).not.toContain("ETc");
    expect(siglas).not.toContain("VND");
    expect(siglas).not.toContain("SUC");
  });

  it("cavalo engatado: as de conjunto entram e as de solo saem", () => {
    const siglas = siglasParaLancar("cavalo", true);
    expect(siglas).toContain("ETc");
    expect(siglas).not.toContain("MAN");
  });

  it("apoio: só as que valem para todos os tipos", () => {
    expect(siglasParaLancar("apoio", false)).not.toContain("ETv");
    expect(siglasParaLancar("apoio", false)).toContain("PÁT");
  });
});
