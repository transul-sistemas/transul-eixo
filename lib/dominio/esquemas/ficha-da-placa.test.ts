import { describe, expect, it } from "vitest";
import { siglaValidaNoContexto } from "../situacao";
import { SIGLAS, SIGLAS_DE_BAIXA } from "../status";
import {
  esquemaCorrigirPlaca,
  esquemaDesatrelar,
  esquemaEngatar,
  esquemaMudarSituacao,
  siglasParaMudar,
} from "./ficha-da-placa";

const AGORA = "2026-11-09T10:30";

describe("siglasParaMudar", () => {
  it("placa solta: só as válidas fora de conjunto, nunca a baixa", () => {
    const lista = siglasParaMudar("cavalo", false);
    expect(lista).toContain("MAN");
    expect(lista).toContain("DOp");
    expect(lista).not.toContain("CAr");
    expect(lista).not.toContain("MAc");
    for (const baixa of SIGLAS_DE_BAIXA) expect(lista).not.toContain(baixa);
  });
  it("conjunto: só as válidas em conjunto", () => {
    const lista = siglasParaMudar("cavalo", true);
    expect(lista).toContain("CAr");
    expect(lista).toContain("MAc");
    expect(lista).not.toContain("MAN");
    expect(lista).not.toContain("SIN");
  });
  it("concorda com a regra única da régua para todas as siglas", () => {
    for (const tipo of ["cavalo", "implemento", "caminhao", "apoio", "equipamento"] as const) {
      for (const conj of [false, true]) {
        const esperado = SIGLAS.filter(
          (s) => !SIGLAS_DE_BAIXA.includes(s) && siglaValidaNoContexto(s, tipo, conj),
        );
        expect([...siglasParaMudar(tipo, conj)].sort()).toEqual([...esperado].sort());
      }
    }
  });
});

describe("esquemaMudarSituacao", () => {
  const esquema = esquemaMudarSituacao({ tipo: "cavalo", emConjunto: false, agora: AGORA });
  const ok = { placa: "aaa-0a00", sigla: "MAN", quando: "2026-11-09T09:00" };
  it("aceita e normaliza a placa", () => {
    const r = esquema.safeParse(ok);
    expect(r.success && r.data.placa).toBe("AAA0A00");
  });
  it("recusa sigla que não vale para o contexto", () => {
    expect(esquema.safeParse({ ...ok, sigla: "CAr" }).success).toBe(false);
  });
  it("recusa a baixa (tem o seu caminho)", () => {
    expect(esquema.safeParse({ ...ok, sigla: "VND" }).success).toBe(false);
  });
  it("recusa data no futuro e data inexistente, aceita o limite", () => {
    expect(esquema.safeParse({ ...ok, quando: "2026-11-09T10:31" }).success).toBe(false);
    expect(esquema.safeParse({ ...ok, quando: "2026-02-30T10:00" }).success).toBe(false);
    expect(esquema.safeParse({ ...ok, quando: "2026-11-09T10:30" }).success).toBe(true);
  });
});

describe("esquemaEngatar", () => {
  const esquema = esquemaEngatar({ agora: AGORA });
  const ok = { placa: "AAA0A00", implemento: "bbb1b11", posicao: 1, quando: "2026-11-09T09:00" };
  it("aceita um engate", () => expect(esquema.safeParse(ok).success).toBe(true));
  it("recusa engatar a placa nela mesma", () => {
    expect(esquema.safeParse({ ...ok, implemento: "AAA0A00" }).success).toBe(false);
  });
  it("a posição vai de 1 a 3", () => {
    expect(esquema.safeParse({ ...ok, posicao: 0 }).success).toBe(false);
    expect(esquema.safeParse({ ...ok, posicao: 4 }).success).toBe(false);
  });
});

describe("esquemaDesatrelar", () => {
  const esquema = esquemaDesatrelar({ agora: AGORA });
  it("pede ao menos um implemento", () => {
    const r = esquema.safeParse({ placa: "AAA0A00", implementos: [], quando: "2026-11-09T09:00" });
    expect(r.success).toBe(false);
  });
  it("aceita um ou mais", () => {
    const r = esquema.safeParse({
      placa: "AAA0A00",
      implementos: ["bbb1b11", "CCC2C22"],
      quando: "2026-11-09T09:00",
    });
    expect(r.success && r.data.implementos).toEqual(["BBB1B11", "CCC2C22"]);
  });
});

describe("esquemaCorrigirPlaca", () => {
  const ok = { placa: "AAA0A00", versaoDaPlaca: 3, motivo: "Conferido no CRLV", eixos: 3 };
  it("exige o motivo e ao menos um campo", () => {
    expect(esquemaCorrigirPlaca.safeParse(ok).success).toBe(true);
    expect(esquemaCorrigirPlaca.safeParse({ ...ok, motivo: " " }).success).toBe(false);
    const semCampo = { placa: ok.placa, versaoDaPlaca: ok.versaoDaPlaca, motivo: ok.motivo };
    expect(esquemaCorrigirPlaca.safeParse(semCampo).success).toBe(false);
  });
  it("confere o dígito do RENAVAM e normaliza", () => {
    expect(esquemaCorrigirPlaca.safeParse({ ...ok, renavam: "123" }).success).toBe(false);
    const r = esquemaCorrigirPlaca.safeParse({ ...ok, renavam: "00639884962" });
    expect(r.success && r.data.renavam).toBe("00639884962");
  });
  it("eixos entre 1 e 9, inteiros", () => {
    expect(esquemaCorrigirPlaca.safeParse({ ...ok, eixos: 0 }).success).toBe(false);
    expect(esquemaCorrigirPlaca.safeParse({ ...ok, eixos: 10 }).success).toBe(false);
    expect(esquemaCorrigirPlaca.safeParse({ ...ok, eixos: 2.5 }).success).toBe(false);
  });
  it("número de série em maiúscula e sem espaços nas pontas", () => {
    const r = esquemaCorrigirPlaca.safeParse({ ...ok, numeroDeSerie: " ab-123 " });
    expect(r.success && r.data.numeroDeSerie).toBe("AB-123");
  });
});
