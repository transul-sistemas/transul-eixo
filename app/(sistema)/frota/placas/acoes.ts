"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { agoraEmSaoPaulo, hojeEmSaoPaulo } from "@/components/formato/data";
import {
  type ContextoDaEscrita,
  executarCadastrarPlaca,
  executarCancelarPedido,
  executarConcluirRecebimento,
  executarCriarItemDeCatalogo,
  executarDevolverPlaca,
  executarDisponibilizarPlaca,
  executarEntregarAoOperacional,
  executarReceber,
} from "@/lib/dados/escrita";
import type { AtualDaAcao, ItemCriado, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { fonteDeEscrita } from "@/lib/dados/fonte";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import {
  ErroDePermissao,
  ErroDeSessao,
  exigirPermissao,
  type Permissao,
} from "@/lib/seguranca/exigir-permissao";
import { gestorAtual } from "@/lib/seguranca/gestor-atual";
import { erroDaAcao, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// As Server Actions de escrita da Frota. São finas: conferem a permissão (`exigirPermissao`), conferem
// o envelope (`chaveDeEnvio` e `dados`) com Zod, deixam o miolo (`lib/dados/escrita.ts`) validar os
// dados com o MESMO esquema da tela e gravar pela fonte, e, só se gravou, invalidam o cache das telas
// afetadas (a lista, a ficha da placa e, nas transferências, o selo "Para receber" do menu). Devolvem
// sempre a linha ou um erro tipado; nunca lançam. Cadastrar e o "+" pedem frota.criar; entregar,
// disponibilizar, receber e concluir mexem numa placa que já existe e pedem frota.editar. O banco
// confere de novo, com o escopo (RLS e as funções atômicas).

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

type Miolo<T> = (
  chave: string,
  dados: unknown,
  contexto: ContextoDaEscrita,
) => Promise<ResultadoDaAcao<T, AtualDaAcao>>;

async function executar<T>(
  bruto: unknown,
  miolo: Miolo<T>,
  caminhosAfetados: (linha: T) => string[],
  permissao: Permissao = { modulo: "frota", acao: "criar" },
  menu = false,
): Promise<ResultadoDaAcao<T, AtualDaAcao>> {
  try {
    await exigirPermissao(permissao);
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    throw erro;
  }
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success) {
    return erroDaAcao("entrada_invalida", {
      mensagem: "O envio chegou incompleto. Feche o assistente, abra de novo e tente outra vez.",
    });
  }
  const agora = new Date();
  let resultado: ResultadoDaAcao<T, AtualDaAcao>;
  try {
    resultado = await miolo(envelope.data.chaveDeEnvio, envelope.data.dados, {
      fonte: await fonteDeEscrita(hojeEmSaoPaulo(agora)),
      agora: agoraEmSaoPaulo(agora),
      hoje: hojeEmSaoPaulo(agora),
      gestorId: await gestorAtual(),
    });
  } catch (erro) {
    console.error("ação de escrita falhou:", erro);
    return erroDaAcao("falha");
  }
  if (resultado.ok) {
    for (const caminho of new Set(["/frota/placas", ...caminhosAfetados(resultado.linha)])) {
      revalidatePath(caminho);
    }
    // O selo do menu (quantas placas esperam por quem usa) mora no layout do sistema.
    if (menu) revalidatePath("/", "layout");
  }
  return resultado;
}

const daPlaca = (linha: { placa: string }) => [`/frota/placas/${linha.placa}`];
const EDITAR: Permissao = { modulo: "frota", acao: "editar" };

export async function cadastrarPlacaAcao(bruto: unknown) {
  return executar<PlacaGravada>(bruto, executarCadastrarPlaca, daPlaca);
}

export async function entregarAoOperacionalAcao(bruto: unknown) {
  return executar<PlacaGravada>(bruto, executarEntregarAoOperacional, daPlaca, EDITAR);
}

export async function disponibilizarPlacaAcao(bruto: unknown) {
  return executar<PedidoDeTransferencia>(bruto, executarDisponibilizarPlaca, daPlaca, EDITAR, true);
}

export async function receberPlacaAcao(bruto: unknown) {
  return executar<PedidoDeTransferencia>(bruto, executarReceber, daPlaca, EDITAR, true);
}

export async function concluirRecebimentoAcao(bruto: unknown) {
  return executar<PlacaGravada>(bruto, executarConcluirRecebimento, daPlaca, EDITAR, true);
}

/** A origem cancela o pedido pendente; o destino devolve o recebido. Os dois mexem no selo do menu. */
export async function cancelarPedidoAcao(bruto: unknown) {
  return executar<PedidoDeTransferencia>(bruto, executarCancelarPedido, daPlaca, EDITAR, true);
}

export async function devolverPlacaAcao(bruto: unknown) {
  return executar<PedidoDeTransferencia>(bruto, executarDevolverPlaca, daPlaca, EDITAR, true);
}

/** O que o "+" cria (marca, modelo, gestor, operação, CR e filial). */
export async function criarItemDeCatalogoAcao(bruto: unknown) {
  return executar<ItemCriado>(bruto, executarCriarItemDeCatalogo, () => []);
}
