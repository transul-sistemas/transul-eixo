import { describe, expect, it } from "vitest";
import { opcoesDoCookie } from "./cookies";

// O cookie da sessão (fatia 3.8): httpOnly, Secure e SameSite=Lax; sem "lembrar de mim" (cookie de
// sessão, sem prazo: fechar o navegador encerra). O @supabase/ssr grava 400 dias e httpOnly falso por
// padrão; o Eixo sobrescreve em todo cookie que grava. Apagar (maxAge 0) continua apagando.

describe("opções do cookie da sessão", () => {
  it("httpOnly, Secure, SameSite=Lax, caminho /, sem prazo", () => {
    expect(
      opcoesDoCookie({ path: "/", sameSite: "lax", httpOnly: false, maxAge: 34_560_000 }),
    ).toEqual({
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: true,
    });
  });
  it("tira também a data de expiração e não aceita SameSite=None", () => {
    const opcoes = opcoesDoCookie({ expires: new Date("2030-01-01"), sameSite: "none" });
    expect(opcoes).not.toHaveProperty("expires");
    expect(opcoes.sameSite).toBe("lax");
  });
  it("apagar o cookie (maxAge 0) continua apagando", () => {
    expect(opcoesDoCookie({ maxAge: 0, path: "/" })).toEqual({
      maxAge: 0,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  });
});
