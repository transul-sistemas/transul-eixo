"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { agoraEmSaoPaulo, hojeEmSaoPaulo } from "@/components/formato/data";
import {
  type ContextoDaEscrita,
  executarCadastrarPlaca,
  executarCriarItemDeCatalogo,
  executarDisponibilizar,
  executarReceber,
} from "@/lib/dados/escrita";
import type { AtualDaAcao, ItemCriado, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { ErroDeGravacaoEmBreve, fonteDeEscrita } from "@/lib/dados/fonte";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { gestorAtual } from "@/lib/seguranca/gestor-atual";
import { erroDaAcao, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// As Server Actions de escrita da Frota. São finas: conferem a permissão (`exigirPermissao`), conferem
// o envelope (`chaveDeEnvio` e `dados`) com Zod, deixam o miolo (`lib/dados/escrita.ts`) validar os
// dados com o MESMO esquema da tela e gravar pela fonte, e, só se gravou, invalidam o cache das telas
// afetadas (a lista e a ficha da placa). Devolvem sempre a linha ou um erro tipado; nunca lançam.

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
): Promise<ResultadoDaAcao<T, AtualDaAcao>> {
  try {
    await exigirPermissao({ modulo: "frota", acao: "criar" });
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
    // Modo banco: as gravações entram na 3.9b; a tela mostra o aviso, sem gravar.
    if (erro instanceof ErroDeGravacaoEmBreve)
      return erroDaAcao("falha", { mensagem: erro.message });
    console.error("ação de escrita falhou:", erro);
    return erroDaAcao("falha");
  }
  if (resultado.ok) {
    for (const caminho of new Set(["/frota/placas", ...caminhosAfetados(resultado.linha)])) {
      revalidatePath(caminho);
    }
  }
  return resultado;
}

const daPlaca = (linha: PlacaGravada) => [`/frota/placas/${linha.placa}`];

export async function cadastrarPlacaAcao(bruto: unknown) {
  return executar(bruto, executarCadastrarPlaca, daPlaca);
}

export async function disponibilizarPlacaAcao(bruto: unknown) {
  return executar(bruto, executarDisponibilizar, daPlaca);
}

export async function receberPlacaAcao(bruto: unknown) {
  return executar(bruto, executarReceber, daPlaca);
}

/** O que o "+" cria (marca, modelo, gestor, operação, CR, filial e garagem). */
export async function criarItemDeCatalogoAcao(bruto: unknown) {
  return executar<ItemCriado>(bruto, executarCriarItemDeCatalogo, () => []);
}
