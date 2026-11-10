"use server";

import { textoDoErro } from "@/lib/log/erro";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { gravarSituacaoDoDia, type SituacaoLancada } from "@/lib/dados/acompanhamento";
import { modoDosDados } from "@/lib/dados/fonte";
import { esquemaLancarSituacao } from "@/lib/dominio/esquemas/acompanhamento";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { chaveDeEnvioValida } from "@/lib/wizard/chave-de-envio";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// Lançar a situação do dia pela grade do Acompanhamento: confere a permissão (frota.criar; o banco
// confere de novo com o escopo da placa), valida o envelope e os dados com o MESMO esquema da tela,
// grava pela função do banco e invalida as telas afetadas (a grade, a lista e a ficha da placa).

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

export async function lancarSituacaoAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<SituacaoLancada>> {
  try {
    await exigirPermissao({ modulo: "frota", acao: "criar" });
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    throw erro;
  }
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success || !chaveDeEnvioValida(envelope.data.chaveDeEnvio)) {
    return erroDaAcao("entrada_invalida", {
      mensagem: "O envio chegou incompleto. Feche o assistente, abra de novo e tente outra vez.",
    });
  }
  const dados = esquemaLancarSituacao.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") {
    return erroDaAcao("entrada_invalida", {
      mensagem: "O Acompanhamento grava só no banco. Rode o sistema com os dados do banco.",
    });
  }
  let resultado: ResultadoDaAcao<SituacaoLancada>;
  try {
    resultado = await gravarSituacaoDoDia(dados.data, envelope.data.chaveDeEnvio);
  } catch (erro) {
    console.error("lançar a situação do dia falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) {
    revalidatePath("/frota/acompanhamento");
    revalidatePath("/frota/placas");
    revalidatePath(`/frota/placas/${resultado.linha.placa}`);
  }
  return resultado;
}
