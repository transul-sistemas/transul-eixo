import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/lib/navegacao/catalogo";
import { MODULOS_POR_PERFIL, PERFIS } from "@/lib/navegacao/perfis";
import { blocoDoSeed } from "@/lib/qualidade/catalogo-de-status";
import {
  ASSINATURA_DAS_PERMISSOES,
  assinaturaDasPermissoes,
  CODIGO_DO_PERFIL,
  PERMISSOES_DOS_PERFIS,
} from "@/lib/seguranca/permissoes";

const seed = readFileSync("supabase/seed.sql", "utf-8");

describe("catálogo de permissões: seed, banco e espelho dizem o mesmo", () => {
  it("a assinatura do espelho é a mesma constante que o pgTAP 50 confere no banco", () => {
    const md5 = createHash("md5").update(assinaturaDasPermissoes(), "utf8").digest("hex");
    expect(md5).toBe(ASSINATURA_DAS_PERMISSOES);
    expect(ASSINATURA_DAS_PERMISSOES).toBe("d343d54d27c68753725c5309d7f09da1");
  });

  it("o seed semeia exatamente as permissões do espelho", () => {
    const doSeed = [
      ...blocoDoSeed(seed, "config.permissao_do_perfil").matchAll(
        /\('(\w+)', '(\w+)', '(\w+)', '(\w+)'\)/g,
      ),
    ]
      .map((m) => `${m[1]}|${m[2]}|${m[3]}|${m[4]}`)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .join(",");
    expect(doSeed).toBe(assinaturaDasPermissoes());
  });

  it("os quatro perfis, com o mesmo nome da navegação", () => {
    expect(Object.keys(CODIGO_DO_PERFIL).sort()).toEqual([...PERFIS].sort());
    for (const perfil of PERFIS) {
      expect(seed, perfil).toContain(`('${CODIGO_DO_PERFIL[perfil]}', '${perfil}')`);
    }
  });

  it("os módulos com alguma permissão são os que a navegação mostra a cada perfil", () => {
    const todos = CATALOGO.map((m) => m.id).sort();
    for (const perfil of PERFIS) {
      const modulos = [...new Set(PERMISSOES_DOS_PERFIS[perfil].map((p) => p.modulo))].sort();
      const naNavegacao = MODULOS_POR_PERFIL[perfil];
      expect(modulos, perfil).toEqual(naNavegacao === "todos" ? todos : [...naNavegacao].sort());
    }
  });

  it("só o Administrador vê o documento completo (pessoas.ver_documento)", () => {
    for (const perfil of PERFIS) {
      const ve = PERMISSOES_DOS_PERFIS[perfil].some(
        (p) => p.modulo === "pessoas" && p.acao === "ver_documento",
      );
      expect(ve, perfil).toBe(perfil === "Administrador");
    }
  });
});
