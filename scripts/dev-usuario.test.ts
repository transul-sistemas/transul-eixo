import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enderecoLocal, lerArgumentosDoUsuario, validarSenha } from "./dev-usuario";

// `pnpm dev:usuario` (fatia 3.9a): cria ou atualiza um login no Auth LOCAL, ligado a uma Pessoa de
// teste. A senha é digitada por quem roda, no terminal, sem eco e duas vezes; o script nunca a mostra,
// nunca a guarda e recusa rodar fora do Supabase local.

describe("lerArgumentosDoUsuario", () => {
  it("Administrador por padrão, com um e-mail de desenvolvimento", () => {
    expect(lerArgumentosDoUsuario([])).toEqual({
      perfil: "administrador",
      email: "dev.administrador@eixo.local",
    });
  });
  it.each(["diretoria", "gestor_de_frota", "operacional"])("aceita o perfil %s", (perfil) => {
    expect(lerArgumentosDoUsuario(["--perfil", perfil]).perfil).toBe(perfil);
  });
  it("aceita o e-mail escolhido", () => {
    expect(lerArgumentosDoUsuario(["--email", "Alexandre@Exemplo.com"]).email).toBe(
      "alexandre@exemplo.com",
    );
  });
  it.each([["--perfil", "dono"], ["--perfil", ""], ["--email", "não é e-mail"]])(
    "recusa %s %j",
    (nome, valor) => {
      expect(() => lerArgumentosDoUsuario([nome, valor])).toThrow();
    },
  );
});

describe("validarSenha", () => {
  it("12 caracteres ou mais, digitada igual duas vezes", () => {
    expect(validarSenha("doze-letras!", "doze-letras!")).toBeNull();
  });
  it("menos de 12 caracteres, recusa", () => {
    expect(validarSenha("onze-letras", "onze-letras")).toMatch(/12 caracteres/);
  });
  it("as duas digitações diferentes, recusa", () => {
    expect(validarSenha("uma-senha-longa", "outra-senha-longa")).toMatch(/não são iguais/);
  });
});

describe("enderecoLocal: só o Supabase da própria máquina", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321"])("aceita %s", (url) => {
    expect(enderecoLocal(url)).toBe(true);
  });
  it.each([
    "https://abcdefgh.supabase.co",
    "http://127.0.0.1.exemplo.com:54321",
    "ftp://localhost",
    "não é endereço",
  ])("recusa %s", (url) => {
    expect(enderecoLocal(url)).toBe(false);
  });
});

describe("o script nunca mostra nem guarda a senha", () => {
  const texto = readFileSync("scripts/dev-usuario.ts", "utf8");
  it("nenhuma saída leva a senha, e nada é gravado em arquivo", () => {
    expect(texto).not.toMatch(/console\.\w+\([^)]*senha/i);
    expect(texto).not.toMatch(/writeFile|appendFile/);
  });
  it("lê a senha sem eco, duas vezes, e confere antes de usar", () => {
    expect(texto.match(/lerSenhaSemEco\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(texto.indexOf("validarSenha(")).toBeLessThan(texto.indexOf("createClient("));
  });
  it("confere que o Supabase é local antes de pedir a senha e de falar com o Auth", () => {
    const confere = texto.indexOf("if (!enderecoLocal(");
    expect(confere).toBeGreaterThan(-1);
    expect(confere).toBeLessThan(texto.indexOf("await lerSenhaSemEco("));
    expect(confere).toBeLessThan(texto.indexOf("createClient("));
  });
});
