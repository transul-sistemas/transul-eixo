import { describe, expect, it } from "vitest";
import {
  CAMPOS_DO_ABASTECIMENTO,
  enderecoDoMesDoAbastecimento,
  lerAbastecimento,
  PADRAO_DO_ABASTECIMENTO,
} from "./abastecimento";

const p = (texto: string) => new URLSearchParams(texto);

describe("estado do Abastecimento na URL", () => {
  it("sem nada: sem mês (o banco escolhe o mais recente com dados), ordem pela placa, página 1", () => {
    const e = lerAbastecimento(p(""));
    expect(e.mes).toBeNull();
    expect(e.consulta.ordem).toEqual({ campo: "placa", sentido: "asc" });
    expect(e.consulta.pagina).toBe(1);
    expect(e.consulta.tam).toBe(PADRAO_DO_ABASTECIMENTO.tam);
    expect(e.consulta.busca).toBe("");
  });

  it("lê mês, busca, ordem decrescente, página e tamanho", () => {
    const e = lerAbastecimento(p("mes=2026-03&q=abc&ordem=-km_por_litro&pagina=3&tam=25"));
    expect(e.mes).toBe("2026-03");
    expect(e.consulta.busca).toBe("abc");
    expect(e.consulta.ordem).toEqual({ campo: "km_por_litro", sentido: "desc" });
    expect(e.consulta.pagina).toBe(3);
    expect(e.consulta.tam).toBe(25);
  });

  it("mês inválido e ordem desconhecida caem no padrão, sem erro", () => {
    const e = lerAbastecimento(p("mes=2026-13&ordem=nome"));
    expect(e.mes).toBeNull();
    expect(e.consulta.ordem.campo).toBe("placa");
  });

  it("os campos de ordem são os que o banco aceita", () => {
    expect([...CAMPOS_DO_ABASTECIMENTO]).toEqual([
      "placa",
      "abastecimentos",
      "litros",
      "km",
      "km_por_litro",
      "valor",
    ]);
  });

  it("trocar de mês volta à página 1 e mantém busca e ordem", () => {
    expect(enderecoDoMesDoAbastecimento(p("q=abc&ordem=-litros&pagina=4"), "2026-02")).toBe(
      "/frota/abastecimento?q=abc&ordem=-litros&mes=2026-02",
    );
  });
});
