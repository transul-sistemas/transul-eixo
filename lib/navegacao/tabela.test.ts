import { describe, expect, it } from "vitest";
import {
  type ConsultaDeTabela,
  escreverTabela,
  lerTabela,
  mudarConsulta,
  TETO_DE_TAM,
} from "./tabela";

const PADRAO = { tam: 25, ordem: "placa" };
const CAMPOS = ["placa", "tipo", "dias", "motorista"] as const;
const ler = (consulta: string) => lerTabela(new URLSearchParams(consulta), PADRAO, CAMPOS);

describe("lerTabela: o que vem da URL", () => {
  it("URL vazia devolve o padrão", () => {
    expect(ler("")).toEqual<ConsultaDeTabela>({
      busca: "",
      chips: [],
      siglas: [],
      baixadas: false,
      ordem: { campo: "placa", sentido: "asc" },
      pagina: 1,
      tam: 25,
    });
  });
  it("lê busca, chips repetidos, siglas, baixadas, ordem, página e tamanho", () => {
    expect(
      ler("q=aaa&chip=patio&chip=fora&sigla=PÁT&sigla=DOp&baixadas=1&ordem=-dias&pagina=3&tam=50"),
    ).toEqual({
      busca: "aaa",
      chips: ["patio", "fora"],
      siglas: ["PÁT", "DOp"],
      baixadas: true,
      ordem: { campo: "dias", sentido: "desc" },
      pagina: 3,
      tam: 50,
    });
  });
  it.each(["0", "-3", "abc", "1.5", ""])("pagina=%s volta para 1", (valor) => {
    expect(ler(`pagina=${valor}`).pagina).toBe(1);
  });
  it("pagina grande é mantida (o servidor limita à última)", () => {
    expect(ler("pagina=9999").pagina).toBe(9999);
  });
  it("tam acima do teto vira o teto; inválido vira o padrão", () => {
    expect(TETO_DE_TAM).toBe(100);
    expect(ler("tam=500").tam).toBe(100);
    expect(ler("tam=100").tam).toBe(100);
    for (const ruim of ["-1", "0", "abc", "", "2.5"]) expect(ler(`tam=${ruim}`).tam, ruim).toBe(25);
  });
  it("ordem desconhecida ou vazia vira o padrão", () => {
    expect(ler("ordem=desconhecida").ordem).toEqual({ campo: "placa", sentido: "asc" });
    expect(ler("ordem=").ordem).toEqual({ campo: "placa", sentido: "asc" });
    expect(ler("ordem=-").ordem).toEqual({ campo: "placa", sentido: "asc" });
    expect(ler("ordem=-desconhecida").ordem).toEqual({ campo: "placa", sentido: "asc" });
  });
  it("ordem crescente e decrescente", () => {
    expect(ler("ordem=tipo").ordem).toEqual({ campo: "tipo", sentido: "asc" });
    expect(ler("ordem=-tipo").ordem).toEqual({ campo: "tipo", sentido: "desc" });
  });
  it("sigla desconhecida é descartada e repetida vira uma só", () => {
    expect(ler("sigla=XYZ&sigla=PÁT&sigla=PÁT").siglas).toEqual(["PÁT"]);
  });
  it("baixadas só liga com 1", () => {
    expect(ler("baixadas=1").baixadas).toBe(true);
    for (const outro of ["0", "true", "", "sim"])
      expect(ler(`baixadas=${outro}`).baixadas, outro).toBe(false);
  });
});

describe("escreverTabela: o que vai para a URL", () => {
  it("omite o que é padrão", () => {
    expect(escreverTabela(new URLSearchParams(), ler(""), PADRAO).toString()).toBe("");
  });
  it("ida e volta: escrever e ler devolve a mesma consulta", () => {
    const original = ler("q=aaa&chip=patio&sigla=PÁT&baixadas=1&ordem=-dias&pagina=3&tam=50");
    const url = escreverTabela(new URLSearchParams(), original, PADRAO);
    expect(lerTabela(url, PADRAO, CAMPOS)).toEqual(original);
  });
  it("deixa intactos o contexto global e o modo", () => {
    const params = new URLSearchParams("periodo=2026-10&filial=todas&modo=agora");
    const url = escreverTabela(params, { ...ler(""), pagina: 2 }, PADRAO);
    expect(url.get("periodo")).toBe("2026-10");
    expect(url.get("filial")).toBe("todas");
    expect(url.get("modo")).toBe("agora");
    expect(url.get("pagina")).toBe("2");
  });
  it("substitui o que havia antes, sem acumular", () => {
    const params = new URLSearchParams("chip=patio&pagina=4&ordem=-dias");
    const url = escreverTabela(params, { ...ler(""), chips: ["fora"] }, PADRAO);
    expect(url.getAll("chip")).toEqual(["fora"]);
    expect(url.has("pagina")).toBe(false);
    expect(url.has("ordem")).toBe(false);
  });
});

describe("mudarConsulta: filtro novo volta para a página 1", () => {
  const na3 = new URLSearchParams("pagina=3&tam=50");
  it.each([
    ["busca", { busca: "x" }],
    ["chips", { chips: ["patio"] }],
    ["siglas", { siglas: ["PÁT" as const] }],
    ["baixadas", { baixadas: true }],
    ["ordem", { ordem: { campo: "tipo", sentido: "asc" as const } }],
    ["tam", { tam: 100 }],
  ])("mudar %s zera a página", (_nome, parcial) => {
    const url = mudarConsulta(na3, parcial, PADRAO, CAMPOS);
    expect(url.has("pagina")).toBe(false);
  });
  it("mudar a própria página mantém o resto", () => {
    const url = mudarConsulta(
      new URLSearchParams("chip=patio&pagina=3"),
      { pagina: 4 },
      PADRAO,
      CAMPOS,
    );
    expect(url.get("pagina")).toBe("4");
    expect(url.getAll("chip")).toEqual(["patio"]);
  });
  it("repetir a mesma consulta (atualizar) não volta à página 1", () => {
    const url = mudarConsulta(na3, {}, PADRAO, CAMPOS);
    expect(url.get("pagina")).toBe("3");
    expect(url.get("tam")).toBe("50");
  });
});
