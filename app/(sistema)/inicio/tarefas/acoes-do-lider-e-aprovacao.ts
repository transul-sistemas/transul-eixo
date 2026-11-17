"use server";

import { noBanco, prepararAcao } from "@/lib/dados/acao-no-banco";
import { decidirAprovacao, pedirAprovacao } from "@/lib/dados/aprovacao";
import { liberarPosicaoDoDia } from "@/lib/dados/posicao-do-dia";
import {
  esquemaDecidirAprovacao,
  esquemaLiberarPosicao,
  esquemaPedirAprovacao,
} from "@/lib/dominio/esquemas/lider-e-aprovacao";
import { exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";

// Liberar a posição do dia (31) e os pedidos de aprovação (37), na caixa de Tarefas. Finas: conferência,
// envelope, dados pelo MESMO esquema da tela e a função do banco, com a invalidação de Tarefas e do Meu dia.
// Liberar e pedir não dependem de módulo: o líder é uma pessoa com vínculo de líder (de qualquer perfil) e
// qualquer pessoa com login pede aprovação; por isso só exigem a sessão, e o banco confere quem é líder
// (nucleo.e_lider_do_gestor). Decidir pede Início › editar (Administrador e Diretoria) e o banco aceita só
// a Diretoria, e quem pediu não decide.

const DECIDIR = { modulo: "inicio", acao: "editar" } as const;
const TELAS = ["/inicio/tarefas", "/inicio/meu-dia"] as const;

/** 31. O líder da operação libera a Posição do dia de um gestor, com motivo. */
export async function liberarPosicaoAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirSessao(),
    bruto,
    (d) => esquemaLiberarPosicao.safeParse(d),
  );
  if (!p.ok) return p.erro;
  const { gestorId, dia, motivo } = p.dados;
  return noBanco(
    "liberar a posição do dia",
    (c) => liberarPosicaoDoDia(c, gestorId, dia, motivo, p.chave),
    TELAS,
  );
}

/** 37. Qualquer pessoa com login pede aprovação ou permissão à Diretoria. */
export async function pedirAprovacaoAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirSessao(),
    bruto,
    (d) => esquemaPedirAprovacao.safeParse(d),
  );
  if (!p.ok) return p.erro;
  return noBanco("pedir aprovação", (c) => pedirAprovacao(c, p.dados, p.chave), TELAS);
}

/** 37. A Diretoria decide (aprovado ou recusado); o banco recusa se quem decide for quem pediu. */
export async function decidirAprovacaoAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirPermissao(DECIDIR),
    bruto,
    (d) => esquemaDecidirAprovacao.safeParse(d),
  );
  if (!p.ok) return p.erro;
  return noBanco("decidir aprovação", (c) => decidirAprovacao(c, p.dados, p.chave), TELAS);
}
