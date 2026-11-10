"use server";

import { textoDoErro } from "@/lib/log/erro";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { modoDosDados } from "@/lib/dados/fonte";
import { gravarAvancoNoPatio, gravarChegada, gravarOrdem } from "@/lib/dados/operacional";
import type { ChegadaRegistrada, OrdemCriada, PlacaAvancada } from "@/lib/dados/operacional-tipos";
import {
  esquemaAvancarNoPatio,
  esquemaCriarOrdem,
  esquemaRegistrarChegada,
} from "@/lib/dominio/esquemas/operacional";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { chaveDeEnvioValida } from "@/lib/wizard/chave-de-envio";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// As gravações do Operacional (Totem, Pátio e Ordens de carregamento): conferem a permissão
// (operacional.criar ou operacional.editar; o banco confere de novo a filial da custódia e a situação),
// validam o envelope e os dados com o MESMO esquema da tela, gravam pela função do banco e invalidam as
// telas afetadas.

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

const ENVIO_INCOMPLETO =
  "O envio chegou incompleto. Feche o assistente, abra de novo e tente outra vez.";
const SO_NO_BANCO = "O Operacional grava só no banco. Rode o sistema com os dados do banco.";

async function conferir(acao: "criar" | "editar"): Promise<ResultadoDaAcao<never> | null> {
  try {
    await exigirPermissao({ modulo: "operacional", acao });
    return null;
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    throw erro;
  }
}

function invalidarOperacional() {
  revalidatePath("/operacional/patio");
  revalidatePath("/operacional/ordens-de-carregamento");
  revalidatePath("/operacional/totem");
  revalidatePath("/frota/placas");
  revalidatePath("/frota/acompanhamento");
}

export async function registrarChegadaAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<ChegadaRegistrada>> {
  const negado = await conferir("criar");
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success || !chaveDeEnvioValida(envelope.data.chaveDeEnvio)) {
    return erroDaAcao("entrada_invalida", { mensagem: ENVIO_INCOMPLETO });
  }
  const dados = esquemaRegistrarChegada.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_NO_BANCO });
  let resultado: ResultadoDaAcao<ChegadaRegistrada>;
  try {
    resultado = await gravarChegada(dados.data, envelope.data.chaveDeEnvio);
  } catch (erro) {
    console.error("registrar a chegada falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) invalidarOperacional();
  return resultado;
}

export async function avancarNoPatioAcao(bruto: unknown): Promise<ResultadoDaAcao<PlacaAvancada>> {
  const negado = await conferir("editar");
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success || !chaveDeEnvioValida(envelope.data.chaveDeEnvio)) {
    return erroDaAcao("entrada_invalida", { mensagem: ENVIO_INCOMPLETO });
  }
  const dados = esquemaAvancarNoPatio.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_NO_BANCO });
  let resultado: ResultadoDaAcao<PlacaAvancada>;
  try {
    resultado = await gravarAvancoNoPatio(dados.data, envelope.data.chaveDeEnvio);
  } catch (erro) {
    console.error("avançar a placa no pátio falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) invalidarOperacional();
  return resultado;
}

export async function criarOrdemAcao(bruto: unknown): Promise<ResultadoDaAcao<OrdemCriada>> {
  const negado = await conferir("criar");
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success || !chaveDeEnvioValida(envelope.data.chaveDeEnvio)) {
    return erroDaAcao("entrada_invalida", { mensagem: ENVIO_INCOMPLETO });
  }
  const dados = esquemaCriarOrdem(hojeEmSaoPaulo(new Date())).safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_NO_BANCO });
  let resultado: ResultadoDaAcao<OrdemCriada>;
  try {
    resultado = await gravarOrdem(dados.data, envelope.data.chaveDeEnvio);
  } catch (erro) {
    console.error("criar a ordem de carregamento falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) invalidarOperacional();
  return resultado;
}
