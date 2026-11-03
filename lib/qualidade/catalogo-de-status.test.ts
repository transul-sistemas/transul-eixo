import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAMADAS_DE_STATUS,
  NOMES_DAS_SIGLAS,
  REGRAS_DAS_SIGLAS,
  SIGLAS,
  type Sigla,
} from "@/lib/dominio/status";
import { NOMES_DOS_CHIPS } from "@/lib/dominio/status";
import type { Status } from "@/lib/visual/tons";
import { blocoDoSeed, lerSiglasDoSeed } from "@/lib/qualidade/catalogo-de-status";

// O seed de produção (supabase/seed.sql) é a fonte do catálogo no banco; o glossário e o espelho em
// TypeScript (lib/dominio/status.ts) precisam dizer a mesma coisa. Este teste lê o texto do seed
// (não sobe o banco) e confere os três.

const seed = readFileSync("supabase/seed.sql", "utf-8");
const glossario = readFileSync("docs/glossario.md", "utf-8");

const bloco = (tabela: string) => blocoDoSeed(seed, tabela);
const siglasDoSeed = () => lerSiglasDoSeed(seed);

describe("seed.sql: a régua de 25 siglas", () => {
  const linhas = siglasDoSeed();
  const porSigla = new Map(linhas.map((l) => [l.sigla, l]));

  it("traz exatamente as 25 siglas do CLAUDE.md, cada uma uma vez", () => {
    expect(linhas.map((l) => l.sigla).sort()).toEqual([...SIGLAS].sort());
    expect(new Set(linhas.map((l) => l.sigla)).size).toBe(25);
  });

  it("nome e chip de cada sigla batem com o docs/glossario.md", () => {
    for (const sigla of SIGLAS) {
      const linha = porSigla.get(sigla);
      expect(linha, sigla).toBeDefined();
      const chip = NOMES_DOS_CHIPS[linha?.chip as Status];
      expect(glossario, sigla).toContain(`| ${sigla} | ${linha?.nome} | ${chip} |`);
      expect(linha?.nome, sigla).toBe(NOMES_DAS_SIGLAS[sigla]);
    }
  });

  it("a ordem é a da régua do CLAUDE.md", () => {
    for (const [indice, sigla] of SIGLAS.entries()) {
      expect(porSigla.get(sigla)?.ordem, sigla).toBe(indice + 1);
    }
  });

  it("camada, aplica_a, tipos válidos e baixada batem com o espelho em TypeScript (Apêndice A)", () => {
    for (const sigla of SIGLAS) {
      const linha = porSigla.get(sigla);
      const regra = REGRAS_DAS_SIGLAS[sigla as Sigla];
      expect(linha?.camada, `${sigla} camada`).toBe(regra.camada);
      expect(linha?.aplicaA, `${sigla} aplica_a`).toBe(regra.aplicaA);
      expect([...(linha?.tipos ?? [])].sort(), `${sigla} tipos`).toEqual(
        [...regra.tiposValidos].sort(),
      );
      expect(linha?.baixada, `${sigla} baixada`).toBe(regra.camada === "baixada");
    }
  });
});

describe("seed.sql: as camadas e os nomes de conjunto", () => {
  it("as cinco camadas, com prioridade de 1 (vence) a 5, na ordem do espelho", () => {
    const camadas = [
      ...bloco("config.camada_de_status").matchAll(/\('([^']+)',\s*'([^']+)',\s*(\d+)\)/g),
    ].map((m) => ({ codigo: m[1], prioridade: Number(m[3]) }));
    expect(camadas.map((c) => c.codigo)).toEqual([...CAMADAS_DE_STATUS]);
    expect(camadas.map((c) => c.prioridade)).toEqual([1, 2, 3, 4, 5]);
  });

  it("as seis carrocerias de partida, no feminino", () => {
    const nomes = [...bloco("config.carroceria").matchAll(/\('([^']+)'\)/g)].map((m) => m[1]);
    expect(nomes).toEqual([
      "Graneleira",
      "Sider",
      "Basculante",
      "Baú frigorífico",
      "Prancha",
      "Tanque",
    ]);
  });

  it("as quatro configurações de conjunto, com a regra da equipe (03/11/2026) pela estrutura", () => {
    const texto = bloco("config.configuracao_de_conjunto");
    const codigos = [...texto.matchAll(/\('([^']+)',\s*'([^']+)',/g)].map((m) => m[1]);
    expect(codigos).toEqual(["simples", "bi", "bitrezao", "rodo"]);
    expect(texto).toMatch(/unidades, com_dolly, eixos_dos_semirreboques, eixos_do_dolly/);
    expect(texto).not.toMatch(/quantidade_de_implementos|eixos_por_implemento/);
  });

  it("os 12 nomes de conjunto semeados são os aprovados", () => {
    const nomes = [
      ...bloco("config.nomenclatura_de_conjunto").matchAll(
        /\('([^']+)',\s*'(simples|bi|bitrezao|rodo)',\s*'([^']+)'\)/g,
      ),
    ].map((m) => `${m[1]}/${m[2]}=${m[3]}`);
    expect(nomes).toEqual([
      "Graneleira/simples=Graneleira",
      "Graneleira/bi=Bitrem",
      "Graneleira/bitrezao=Bitrezão",
      "Graneleira/rodo=Rodotrem",
      "Sider/simples=Sider",
      "Sider/bi=Bisider",
      "Sider/bitrezao=Bitrezão sider",
      "Sider/rodo=Rodosider",
      "Basculante/simples=Basculante",
      "Basculante/bi=Bicaçamba",
      "Basculante/bitrezao=Bitrezão basculante",
      "Basculante/rodo=Rodocaçamba",
    ]);
  });

  it("não semeia marca, modelo nem filial (entram pelo + e, depois, pela ponte)", () => {
    for (const tabela of ["marca", "modelo", "filial"]) {
      expect(seed, tabela).not.toMatch(new RegExp(`insert\\s+into\\s+config\\.${tabela}\\b`, "i"));
    }
  });
});
