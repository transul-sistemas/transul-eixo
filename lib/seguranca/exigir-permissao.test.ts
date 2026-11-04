import { describe, expect, it } from "vitest";
import type { IdDoModulo } from "@/lib/navegacao/catalogo";
import { PERFIS, type Perfil } from "@/lib/navegacao/perfis";
import type { ClienteDaSessao } from "./cliente-da-sessao";
import { ErroDePermissao, ErroDeSessao, exigirPermissao, temPermissao } from "./exigir-permissao";
import { CODIGO_DO_PERFIL, PERMISSOES_DOS_PERFIS } from "./permissoes";

// exigirPermissao() (fatia 3.8): assíncrona; pega o usuário pelo getUser (nunca getSession) e pergunta
// ao banco (config.pode) a cada chamada, com a chave do próprio usuário. Aqui a sessão é simulada: o
// "banco" falso responde pela tabela de permissões do seed (o espelho em TypeScript).

type Chamada = { esquema: string; funcao: string; argumentos: Record<string, unknown> | undefined };

function sessaoSimulada(
  perfil: Perfil | null,
  opcoes: { semUsuario?: boolean; erroNoBanco?: boolean } = {},
) {
  const chamadas: Chamada[] = [];
  const cliente: ClienteDaSessao = {
    auth: {
      getUser: async () => ({
        data: {
          user: opcoes.semUsuario ? null : { id: "usuario-1", email: "pessoa@exemplo.local" },
        },
        error: null,
      }),
    },
    schema: (esquema) => ({
      rpc: async (funcao, argumentos) => {
        chamadas.push({ esquema, funcao, argumentos });
        if (opcoes.erroNoBanco) return { data: null, error: { message: "falhou" } };
        if (funcao === "perfil_atual")
          return { data: perfil ? CODIGO_DO_PERFIL[perfil] : null, error: null };
        if (funcao === "pode") {
          const { p_modulo, p_acao } = argumentos as { p_modulo: string; p_acao: string };
          const pode =
            perfil !== null &&
            PERMISSOES_DOS_PERFIS[perfil].some((p) => p.modulo === p_modulo && p.acao === p_acao);
          return { data: pode, error: null };
        }
        return { data: null, error: { message: `função inesperada ${funcao}` } };
      },
    }),
  };
  return { cliente, chamadas };
}

const MODULOS: IdDoModulo[] = [
  "inicio",
  "frota",
  "operacional",
  "operacoes",
  "pessoas",
  "parceiros",
  "resultados",
  "cadastros",
  "admin",
];
const ACOES = ["criar", "editar", "excluir"] as const;

describe("exigirPermissao (sessão simulada, para cada perfil e ação)", () => {
  for (const perfil of PERFIS) {
    it(`${perfil}: o banco decide cada módulo e ação`, async () => {
      for (const modulo of MODULOS) {
        for (const acao of ACOES) {
          const { cliente, chamadas } = sessaoSimulada(perfil);
          const esperado = PERMISSOES_DOS_PERFIS[perfil].some(
            (p) => p.modulo === modulo && p.acao === acao,
          );
          const resultado = exigirPermissao({ modulo, acao }, cliente);
          if (esperado)
            await expect(resultado, `${perfil} ${modulo} ${acao}`).resolves.toBeUndefined();
          else
            await expect(resultado, `${perfil} ${modulo} ${acao}`).rejects.toBeInstanceOf(
              ErroDePermissao,
            );
          expect(chamadas).toContainEqual({
            esquema: "config",
            funcao: "pode",
            argumentos: { p_modulo: modulo, p_acao: acao },
          });
        }
      }
    });
  }

  it("sem sessão lança ErroDeSessao e nem pergunta ao banco", async () => {
    const { cliente, chamadas } = sessaoSimulada("Administrador", { semUsuario: true });
    await expect(
      exigirPermissao({ modulo: "frota", acao: "criar" }, cliente),
    ).rejects.toBeInstanceOf(ErroDeSessao);
    expect(chamadas).toEqual([]);
  });

  it("erro do banco nunca vira permissão (lança)", async () => {
    const { cliente } = sessaoSimulada("Administrador", { erroNoBanco: true });
    const erro = await exigirPermissao({ modulo: "frota", acao: "criar" }, cliente).catch(
      (e: unknown) => e,
    );
    expect(erro).not.toBeInstanceOf(ErroDePermissao);
    expect((erro as Error).message).toMatch(/Não foi possível conferir a permissão/);
  });

  it("a mensagem diz o que falta e como resolver, sem pedir desculpas", async () => {
    const { cliente } = sessaoSimulada("Operacional");
    const erro = (await exigirPermissao({ modulo: "frota", acao: "criar" }, cliente).catch(
      (e: unknown) => e,
    )) as ErroDePermissao;
    expect(erro.codigo).toBe("sem_permissao");
    expect(erro.modulo).toBe("frota");
    expect(erro.acao).toBe("criar");
    expect(erro.message).toMatch(/Peça a quem administra o acesso/);
    expect(erro.message.toLowerCase()).not.toMatch(/desculp/);
  });
});

describe("temPermissao: o espelho, só para montar menus", () => {
  it("segue o seed: Gestor de frota cria em Frota e não em Operacional; Operacional o contrário", () => {
    expect(temPermissao("Gestor de frota", { modulo: "frota", acao: "criar" })).toBe(true);
    expect(temPermissao("Gestor de frota", { modulo: "operacional", acao: "criar" })).toBe(false);
    expect(temPermissao("Operacional", { modulo: "frota", acao: "criar" })).toBe(false);
    expect(temPermissao("Operacional", { modulo: "operacional", acao: "criar" })).toBe(true);
    expect(temPermissao("Administrador", { modulo: "admin", acao: "excluir" })).toBe(true);
  });
  it("perfil desconhecido nunca tem permissão", () => {
    expect(temPermissao("Visitante" as never, { modulo: "frota", acao: "criar" })).toBe(false);
  });
});
