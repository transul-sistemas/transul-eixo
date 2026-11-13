import { describe, expect, it } from "vitest";
import { decidirAcesso } from "@/lib/seguranca/acesso";
import { acharTela, todasAsTelas } from "./catalogo";
import { montarGrupos } from "./busca-rapida";
import { montarMapa } from "./mapa-do-sistema";
import { PERFIS, TELAS_SO_DO_ADMINISTRADOR } from "./perfis";
import { modulosVisiveis, podeAbrir, rotaInicialDoModulo } from "./visibilidade";

// Meu dia atrás de um indicador de teste. O Administrador a vê sempre. O Gestor de frota a vê (menu,
// Ctrl+K, mapa e rota) só enquanto o parâmetro banco_em_demonstracao está LIGADO; desligado (banco real),
// só o Administrador. Diretoria e Operacional nunca. Critério (d) do inventário: rota, menu, Ctrl+K,
// permissão; cada um provado para os quatro perfis nas duas situações do parâmetro.

const ROTA = "/inicio/meu-dia";
const tela = () => {
  const achada = acharTela(ROTA);
  if (!achada) throw new Error("O Meu dia saiu do catálogo");
  return achada.tela;
};
const contexto = { fixados: [], recentes: [] };

/** Quem deve ver, dada a situação do parâmetro. */
const devePoder = (perfil: (typeof PERFIS)[number], emDemonstracao: boolean) =>
  perfil === "Administrador" || (perfil === "Gestor de frota" && emDemonstracao);

const SITUACOES = [true, false] as const;
const nome = (em: boolean) => (em ? "parâmetro ligado" : "parâmetro desligado");

describe("Meu dia (indicador de teste)", () => {
  it("está no catálogo, no módulo Início, com o selo Teste", () => {
    expect(tela().id).toBe("inicio.meu-dia");
    expect(tela().selo).toBe("Teste");
    expect(TELAS_SO_DO_ADMINISTRADOR).toContain("inicio.meu-dia");
  });

  for (const em of SITUACOES) {
    describe(nome(em), () => {
      it("abre para quem deve", () => {
        for (const perfil of PERFIS) {
          expect(podeAbrir(perfil, tela(), em), perfil).toBe(devePoder(perfil, em));
        }
      });

      it("aparece no menu de quem deve", () => {
        for (const perfil of PERFIS) {
          const ids = modulosVisiveis(perfil, undefined, em).flatMap((m) => m.telas.map((t) => t.id));
          expect(ids.includes("inicio.meu-dia"), perfil).toBe(devePoder(perfil, em));
        }
      });

      it("aparece no Ctrl+K de quem deve", () => {
        for (const perfil of PERFIS) {
          const itens = montarGrupos("meu dia", perfil, contexto, undefined, undefined, em).flatMap(
            (g) => g.itens,
          );
          expect(
            itens.some((i) => i.id === "inicio.meu-dia"),
            perfil,
          ).toBe(devePoder(perfil, em));
        }
      });

      it("a rota segue para quem deve e responde como não encontrada para os demais", () => {
        for (const perfil of PERFIS) {
          const decisao = decidirAcesso(ROTA, "", {
            temUsuario: true,
            temVinculo: true,
            perfil,
            podeVerModulo: true,
            emDemonstracao: em,
          });
          expect(decisao.tipo, perfil).toBe(devePoder(perfil, em) ? "seguir" : "nao-encontrada");
        }
      });

      it("aparece no mapa do sistema de quem deve", () => {
        for (const perfil of PERFIS) {
          const ids = montarMapa(perfil, "todos", undefined, em).modulos.flatMap((m) =>
            m.telas.map((t) => t.tela.id),
          );
          expect(ids.includes("inicio.meu-dia"), perfil).toBe(devePoder(perfil, em));
        }
      });

      it("não vira a primeira tela do Início de ninguém: Tarefas continua na frente", () => {
        for (const perfil of PERFIS) {
          expect(rotaInicialDoModulo(perfil, "inicio", undefined, em)).toBe("/inicio/tarefas");
        }
      });
    });
  }

  it("sem informar o parâmetro, vale o desligado (só o Administrador)", () => {
    for (const perfil of PERFIS) {
      expect(podeAbrir(perfil, tela()), perfil).toBe(perfil === "Administrador");
    }
  });

  it("toda tela só do Administrador existe no catálogo", () => {
    const ids = todasAsTelas().map((t) => t.id);
    for (const id of TELAS_SO_DO_ADMINISTRADOR) expect(ids).toContain(id);
  });
});
