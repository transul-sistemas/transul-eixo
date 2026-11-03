import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIPOS_DE_ATIVO } from "@/lib/dados/placas-tipos";
import {
  carroceriaExigida,
  carroceriaPermitida,
  FUNCOES_DO_IMPLEMENTO,
  motivoDeCarroceriaInvalida,
  TIPOS_QUE_ACEITAM_CARROCERIA,
} from "@/lib/dominio/carroceria";

describe("carroceria por tipo de ativo e função do implemento", () => {
  it("o implemento tem duas funções: semirreboque e dolly", () => {
    expect([...FUNCOES_DO_IMPLEMENTO]).toEqual(["semirreboque", "dolly"]);
  });

  it("vale para semirreboque e caminhão; dolly, cavalo, equipamento e apoio não têm", () => {
    expect([...TIPOS_QUE_ACEITAM_CARROCERIA].sort()).toEqual(["caminhao", "implemento"]);
    for (const tipo of TIPOS_DE_ATIVO) {
      if (tipo === "implemento") continue;
      expect(carroceriaPermitida(tipo, null), tipo).toBe(tipo === "caminhao");
    }
    expect(carroceriaPermitida("implemento", "semirreboque")).toBe(true);
    expect(carroceriaPermitida("implemento", "dolly")).toBe(false);
  });

  it("é obrigatória só no semirreboque (o caminhão pode estar sem, até a equipe informar)", () => {
    for (const tipo of TIPOS_DE_ATIVO) {
      if (tipo === "implemento") continue;
      expect(carroceriaExigida(tipo, null), tipo).toBe(false);
    }
    expect(carroceriaExigida("implemento", "semirreboque")).toBe(true);
    expect(carroceriaExigida("implemento", "dolly")).toBe(false);
  });

  it("motivoDeCarroceriaInvalida diz o que está errado, ou devolve nulo", () => {
    const m = motivoDeCarroceriaInvalida;
    expect(m({ tipo: "implemento", funcao: null, temCarroceria: true })).toBe(
      "Escolha a função do implemento: semirreboque ou dolly.",
    );
    expect(m({ tipo: "cavalo", funcao: "dolly", temCarroceria: false })).toBe(
      "Só implemento tem função (semirreboque ou dolly).",
    );
    expect(m({ tipo: "implemento", funcao: "semirreboque", temCarroceria: false })).toBe(
      "O semirreboque precisa de carroceria.",
    );
    expect(m({ tipo: "implemento", funcao: "dolly", temCarroceria: true })).toBe(
      "O dolly não tem carroceria.",
    );
    expect(m({ tipo: "implemento", funcao: "semirreboque", temCarroceria: true })).toBeNull();
    expect(m({ tipo: "implemento", funcao: "dolly", temCarroceria: false })).toBeNull();
    expect(m({ tipo: "caminhao", funcao: null, temCarroceria: true })).toBeNull();
    expect(m({ tipo: "caminhao", funcao: null, temCarroceria: false })).toBeNull();
    for (const tipo of ["cavalo", "equipamento", "apoio"] as const) {
      expect(m({ tipo, funcao: null, temCarroceria: true }), tipo).toBe(
        "Só semirreboque ou caminhão têm carroceria.",
      );
      expect(m({ tipo, funcao: null, temCarroceria: false }), tipo).toBeNull();
    }
  });
});

describe("a migration da 3.4 diz a mesma coisa que o domínio", () => {
  const migration = readFileSync(
    "supabase/migrations/20261103130413_composicao_e_conjunto.sql",
    "utf-8",
  );

  it("função só no implemento; carroceria obrigatória no semirreboque e proibida no dolly", () => {
    expect(migration).toMatch(
      /add constraint ativo_funcao_so_no_implemento\s+check \(\(tipo = 'implemento'\) = \(funcao is not null\)\)/,
    );
    expect(migration).toMatch(
      /add constraint ativo_carroceria_obrigatoria_no_semirreboque\s+check \(funcao is distinct from 'semirreboque' or carroceria_id is not null\)/,
    );
    expect(migration).toMatch(
      /add constraint ativo_dolly_sem_carroceria\s+check \(funcao is distinct from 'dolly' or carroceria_id is null\)/,
    );
    expect(migration).toMatch(/drop constraint ativo_carroceria_obrigatoria_no_implemento/);
  });
});
