import { describe, expect, it } from "vitest";
import {
  enderecoDaEscala,
  enderecoDaOperacao,
  lerEscala,
  lerPessoas,
  mesVizinho,
  ROTA_DAS_PESSOAS,
} from "./pessoas";

const OPERACAO = "2f6c1c55-3a8e-4a57-9a0b-6f1d2b7c9e10";

describe("lerPessoas", () => {
  it("lê busca, chips conhecidos, operação válida, ordem e página da URL", () => {
    const e = lerPessoas(
      new URLSearchParams(
        `q=ana&chip=sem_vinculo&chip=motorista&chip=x&operacao=${OPERACAO}&ordem=-desde&pagina=2`,
      ),
    );
    expect(e.operacao).toBe(OPERACAO);
    expect(e.consulta.busca).toBe("ana");
    expect(e.consulta.chips).toEqual(["sem_vinculo", "motorista"]);
    expect(e.consulta.ordem).toEqual({ campo: "desde", sentido: "desc" });
    expect(e.consulta.pagina).toBe(2);
  });
  it("operação que não é uuid e ordem desconhecida caem no padrão", () => {
    const e = lerPessoas(new URLSearchParams("operacao=abc&ordem=cpf"));
    expect(e.operacao).toBeNull();
    expect(e.consulta.ordem).toEqual({ campo: "nome", sentido: "asc" });
  });
});

describe("enderecoDaOperacao", () => {
  it("troca a operação, volta à página 1 e mantém a busca", () => {
    expect(
      enderecoDaOperacao(ROTA_DAS_PESSOAS, new URLSearchParams("q=ana&pagina=3"), OPERACAO),
    ).toBe(`${ROTA_DAS_PESSOAS}?q=ana&operacao=${OPERACAO}`);
    expect(enderecoDaOperacao(ROTA_DAS_PESSOAS, new URLSearchParams("operacao=x"), null)).toBe(
      ROTA_DAS_PESSOAS,
    );
  });
});

describe("escala na URL", () => {
  it("lê a operação e o mês válidos", () => {
    expect(lerEscala(new URLSearchParams(`operacao=${OPERACAO}&mes=2026-06`))).toEqual({
      operacao: OPERACAO,
      mes: "2026-06",
    });
    expect(lerEscala(new URLSearchParams("operacao=1&mes=2026-13"))).toEqual({
      operacao: null,
      mes: null,
    });
  });
  it("escreve o endereço e anda de mês, virando o ano", () => {
    expect(enderecoDaEscala(OPERACAO, "2026-06")).toBe(
      `/pessoas/escala?operacao=${OPERACAO}&mes=2026-06`,
    );
    expect(mesVizinho("2026-01", -1)).toBe("2025-12");
    expect(mesVizinho("2026-12", 1)).toBe("2027-01");
    expect(mesVizinho("2026-06", 1)).toBe("2026-07");
  });
});
