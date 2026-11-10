"use server";

import { textoDoErro } from "@/lib/log/erro";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { modoDosDados } from "@/lib/dados/fonte";
import {
  gravarEncerramento,
  gravarJustificativa,
  gravarLocacao,
  gravarParceiro,
} from "@/lib/dados/parceiros";
import type {
  JustificativaGravada,
  LocacaoGravada,
  ParceiroCadastrado,
} from "@/lib/dados/parceiros-tipos";
import {
  esquemaCadastrarLocacao,
  esquemaCadastrarParceiro,
  esquemaEncerrarLocacao,
  esquemaJustificarDiferenca,
} from "@/lib/dominio/esquemas/parceiros";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { chaveDeEnvioValida } from "@/lib/wizard/chave-de-envio";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// As gravações de Parceiros (Cadastrar parceiro, Justificar diferença, Cadastrar locação e Encerrar
// locação): conferem a permissão (parceiros.criar ou parceiros.editar; o banco confere de novo),
// validam o envelope e os dados com o MESMO esquema da tela, gravam pela função do banco com a chave de
// envio e invalidam as telas afetadas.

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

const ENVIO_INCOMPLETO =
  "O envio chegou incompleto. Feche o assistente, abra de novo e tente outra vez.";
const SO_NO_BANCO = "Parceiros grava só no banco. Rode o sistema com os dados do banco.";

async function conferir(acao: "criar" | "editar"): Promise<ResultadoDaAcao<never> | null> {
  try {
    await exigirPermissao({ modulo: "parceiros", acao });
    return null;
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    throw erro;
  }
}

function invalidarParceiros() {
  revalidatePath("/parceiros/lista", "layout");
  revalidatePath("/parceiros/conciliacao");
  revalidatePath("/parceiros/locacao");
}

export async function cadastrarParceiroAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<ParceiroCadastrado>> {
  const negado = await conferir("criar");
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success || !chaveDeEnvioValida(envelope.data.chaveDeEnvio)) {
    return erroDaAcao("entrada_invalida", { mensagem: ENVIO_INCOMPLETO });
  }
  const dados = esquemaCadastrarParceiro.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_NO_BANCO });
  let resultado: ResultadoDaAcao<ParceiroCadastrado>;
  try {
    resultado = await gravarParceiro(dados.data, envelope.data.chaveDeEnvio);
  } catch (erro) {
    console.error("cadastrar o parceiro falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) invalidarParceiros();
  return resultado;
}

export async function justificarDiferencaAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<JustificativaGravada>> {
  const negado = await conferir("criar");
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success || !chaveDeEnvioValida(envelope.data.chaveDeEnvio)) {
    return erroDaAcao("entrada_invalida", { mensagem: ENVIO_INCOMPLETO });
  }
  const dados = esquemaJustificarDiferenca.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_NO_BANCO });
  let resultado: ResultadoDaAcao<JustificativaGravada>;
  try {
    resultado = await gravarJustificativa(dados.data, envelope.data.chaveDeEnvio);
  } catch (erro) {
    console.error("justificar a diferença falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) invalidarParceiros();
  return resultado;
}

export async function cadastrarLocacaoAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<LocacaoGravada>> {
  const negado = await conferir("criar");
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success || !chaveDeEnvioValida(envelope.data.chaveDeEnvio)) {
    return erroDaAcao("entrada_invalida", { mensagem: ENVIO_INCOMPLETO });
  }
  const dados = esquemaCadastrarLocacao.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_NO_BANCO });
  let resultado: ResultadoDaAcao<LocacaoGravada>;
  try {
    resultado = await gravarLocacao(dados.data, envelope.data.chaveDeEnvio);
  } catch (erro) {
    console.error("cadastrar a locação falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) invalidarParceiros();
  return resultado;
}

export async function encerrarLocacaoAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<LocacaoGravada>> {
  const negado = await conferir("editar");
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success || !chaveDeEnvioValida(envelope.data.chaveDeEnvio)) {
    return erroDaAcao("entrada_invalida", { mensagem: ENVIO_INCOMPLETO });
  }
  const dados = esquemaEncerrarLocacao.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_NO_BANCO });
  let resultado: ResultadoDaAcao<LocacaoGravada>;
  try {
    resultado = await gravarEncerramento(dados.data, envelope.data.chaveDeEnvio);
  } catch (erro) {
    console.error("encerrar a locação falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) invalidarParceiros();
  return resultado;
}
