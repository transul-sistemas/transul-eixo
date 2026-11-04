import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A confirmação do link do e-mail (fatia 3.8): cria a sessão e já grava a marca de atividade (sem ela, o
// proxy trataria a sessão nova como vencida); link inválido volta a /entrar com o motivo.

const simulado = vi.hoisted(() => ({
  erro: null as { message: string } | null,
  verificar: vi.fn(),
}));

vi.mock("@/lib/supabase/servidor", () => ({
  criarClienteDoServidor: async () => ({
    auth: {
      verifyOtp: async (args: unknown) => {
        simulado.verificar(args);
        return { error: simulado.erro };
      },
    },
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  simulado.erro = null;
  simulado.verificar.mockClear();
});

const pedido = (busca: string) => new NextRequest(`http://localhost:3000/auth/confirmar${busca}`);

describe("/auth/confirmar", () => {
  it("link válido: confere o token, grava a marca de atividade e vai ao próximo interno", async () => {
    const resposta = await GET(pedido("?proximo=/nova-senha&token_hash=abc&type=recovery"));
    expect(simulado.verificar).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
    expect(resposta.headers.get("location")).toBe("http://localhost:3000/nova-senha");
    const marca = resposta.cookies.get("eixo_ultima_atividade");
    expect(marca?.value).toMatch(/^\d+$/);
    expect(marca?.httpOnly).toBe(true);
  });

  it("link inválido ou de outro tipo: /entrar com o motivo, sem marca", async () => {
    simulado.erro = { message: "expirado" };
    const vencido = await GET(pedido("?proximo=/nova-senha&token_hash=abc&type=recovery"));
    expect(vencido.headers.get("location")).toBe(
      "http://localhost:3000/entrar?motivo=link-invalido",
    );
    expect(vencido.cookies.get("eixo_ultima_atividade")).toBeUndefined();
    simulado.erro = null;
    const outroTipo = await GET(pedido("?token_hash=abc&type=signup"));
    expect(outroTipo.headers.get("location")).toBe(
      "http://localhost:3000/entrar?motivo=link-invalido",
    );
  });

  it("o próximo de fora vira a tela inicial", async () => {
    const resposta = await GET(pedido("?proximo=//exemplo.com&token_hash=abc&type=recovery"));
    expect(resposta.headers.get("location")).toBe("http://localhost:3000/inicio/tarefas");
  });
});
