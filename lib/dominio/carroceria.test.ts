import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIPOS_DE_ATIVO } from "@/lib/dados/placas-tipos";
import {
  carroceriaExigida,
  carroceriaPermitida,
  motivoDeCarroceriaInvalida,
  TIPOS_QUE_ACEITAM_CARROCERIA,
} from "@/lib/dominio/carroceria";

describe("carroceria por tipo de ativo", () => {
  it("vale para implemento e caminhão; cavalo, equipamento e apoio não têm", () => {
    expect([...TIPOS_QUE_ACEITAM_CARROCERIA].sort()).toEqual(["caminhao", "implemento"]);
    for (const tipo of TIPOS_DE_ATIVO) {
      expect(carroceriaPermitida(tipo), tipo).toBe(tipo === "implemento" || tipo === "caminhao");
    }
  });

  it("é obrigatória só no implemento (o caminhão pode estar sem, até a equipe informar)", () => {
    for (const tipo of TIPOS_DE_ATIVO) {
      expect(carroceriaExigida(tipo), tipo).toBe(tipo === "implemento");
    }
  });

  it("motivoDeCarroceriaInvalida diz o que está errado, ou devolve nulo", () => {
    expect(motivoDeCarroceriaInvalida({ tipo: "implemento", temCarroceria: false })).toBe(
      "O implemento precisa de carroceria.",
    );
    expect(motivoDeCarroceriaInvalida({ tipo: "implemento", temCarroceria: true })).toBeNull();
    expect(motivoDeCarroceriaInvalida({ tipo: "caminhao", temCarroceria: true })).toBeNull();
    expect(motivoDeCarroceriaInvalida({ tipo: "caminhao", temCarroceria: false })).toBeNull();
    for (const tipo of ["cavalo", "equipamento", "apoio"] as const) {
      expect(motivoDeCarroceriaInvalida({ tipo, temCarroceria: true }), tipo).toBe(
        "Só implemento ou caminhão têm carroceria.",
      );
      expect(motivoDeCarroceriaInvalida({ tipo, temCarroceria: false }), tipo).toBeNull();
    }
  });
});

describe("a migration da 3.1 diz a mesma coisa que o domínio", () => {
  const migration = readFileSync(
    "supabase/migrations/20261101022852_catalogos_e_regua.sql",
    "utf-8",
  );

  it("o CHECK exige carroceria no implemento e a proíbe fora de implemento e caminhão", () => {
    expect(migration).toMatch(
      /add constraint ativo_carroceria_obrigatoria_no_implemento\s+check \(tipo <> 'implemento' or carroceria_id is not null\)/,
    );
    const lista = TIPOS_QUE_ACEITAM_CARROCERIA.map((t) => `'${t}'`).sort();
    const achado =
      /add constraint ativo_carroceria_so_em_implemento_e_caminhao\s+check \(tipo in \(([^)]*)\) or carroceria_id is null\)/.exec(
        migration,
      );
    expect(achado, "CHECK da proibição").not.toBeNull();
    const naMigration = (achado?.[1] ?? "")
      .split(",")
      .map((t) => t.trim())
      .sort();
    expect(naMigration).toEqual(lista);
  });
});
