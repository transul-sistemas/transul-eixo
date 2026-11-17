"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ClienteDeEscrita } from "@/lib/dados/escrita-do-banco";
import { modoDosDados } from "@/lib/dados/fonte";
import {
  buscarCidades,
  type CidadeDaPosicao,
  type DistanciaImprovavel,
  lerDistanciaImprovavel,
  registrarPosicaoDoDia,
} from "@/lib/dados/posicao-do-dia";
import { esquemaRespostaDaPosicao } from "@/lib/dominio/posicao-do-dia";
import { textoDoErro } from "@/lib/log/erro";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { chaveDeEnvioValida } from "@/lib/wizard/chave-de-envio";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";

// Posição do dia (M2), a porta obrigatória do Meu dia: buscar a cidade, conferir a distância improvável e
// gravar a resposta de um conjunto. Finas: conferem a permissão, validam com Zod (o MESMO esquema da
// tela) e deixam o banco conferir quem chama (só o gestor da carteira grava).

async function permitir(): Promise<ResultadoDaAcao<never> | null> {
  try {
    await exigirPermissao({ modulo: "frota", acao: "editar" });
    return null;
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    throw erro;
  }
}

async function cliente(): Promise<ClienteDeEscrita> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
}

const SO_BANCO = "A Posição do dia grava só no banco. Rode o sistema com os dados do banco.";

export async function buscarCidadesAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<CidadeDaPosicao[]>> {
  const negado = await permitir();
  if (negado) return negado;
  const busca = z.string().max(60).safeParse(bruto);
  if (!busca.success) return erroDaAcao("entrada_invalida");
  if (modoDosDados() !== "banco") return sucesso([]);
  try {
    return sucesso(await buscarCidades(await cliente(), busca.data));
  } catch (erro) {
    console.error("buscar cidades falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
}

const PAR = z.object({ de: z.number().int().positive(), para: z.number().int().positive() });

export async function conferirDistanciaAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<DistanciaImprovavel>> {
  const negado = await permitir();
  if (negado) return negado;
  const par = PAR.safeParse(bruto);
  if (!par.success) return erroDaAcao("entrada_invalida");
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_BANCO });
  try {
    return sucesso(await lerDistanciaImprovavel(await cliente(), par.data.de, par.data.para));
  } catch (erro) {
    console.error("conferir distância falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
}

const ENVELOPE = z.object({
  chaveDeEnvio: z.string().refine(chaveDeEnvioValida, "Chave de envio inválida."),
  dados: z.unknown(),
});

export async function registrarPosicaoAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<{ posicaoId: string }>> {
  const negado = await permitir();
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success) {
    return erroDaAcao("entrada_invalida", {
      mensagem: "O envio chegou incompleto. Recarregue a página e responda de novo.",
    });
  }
  const dados = esquemaRespostaDaPosicao.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_BANCO });
  try {
    const r = await registrarPosicaoDoDia(await cliente(), dados.data, envelope.data.chaveDeEnvio);
    if (r.ok) revalidatePath("/inicio/meu-dia");
    return r;
  } catch (erro) {
    console.error("registrar posição falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
}
