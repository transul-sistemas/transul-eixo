import { describe, expect, it } from "vitest";
import { destinoDoModulo } from "./redirecionar";

const parametros = (texto: string) => new URLSearchParams(texto);

describe("destinoDoModulo (para onde /frota, /pessoas etc. redirecionam)", () => {
  it("é a primeira tela que o perfil abre", () => {
    expect(destinoDoModulo("Administrador", "frota", parametros(""))).toBe("/frota/acompanhamento");
    expect(destinoDoModulo("Administrador", "admin", parametros(""))).toBe(
      "/admin/usuarios-e-perfis",
    );
  });
  it("leva o contexto global junto", () => {
    expect(destinoDoModulo("Administrador", "frota", parametros("periodo=2026-09"))).toBe(
      "/frota/acompanhamento?periodo=2026-09",
    );
  });
  it("não leva filtros de tela, que não fazem sentido na tela de destino", () => {
    expect(destinoDoModulo("Administrador", "frota", parametros("q=abc&chip=x&modo=mapa"))).toBe(
      "/frota/acompanhamento",
    );
  });
  it("sem tela aberta para o perfil, não há destino", () => {
    expect(destinoDoModulo("Gestor de frota", "pessoas", parametros(""))).toBeUndefined();
    expect(destinoDoModulo("Operacional", "frota", parametros(""))).toBeUndefined();
  });
  it("com as Placas prontas, o Gestor de frota é levado a elas", () => {
    expect(destinoDoModulo("Gestor de frota", "frota", parametros(""))).toBe("/frota/placas");
  });
});
