"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type CarteiraConfirmada, gravarConfirmacaoDaCarteira } from "@/lib/dados/acompanhamento";
import { modoDosDados } from "@/lib/dados/fonte";
import { esquemaConfirmarCarteira } from "@/lib/dominio/esquemas/acompanhamento";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { chaveDeEnvioValida } from "@/lib/wizard/chave-de-envio";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// Confirmar a carteira do mês (uma placa ou várias): confere a permissão (frota.editar; o banco
// confere que é o próprio gestor e que cada placa estava na carteira dele no mês), valida com o MESMO
// esquema da tela, grava pela função do banco e invalida a tela da carteira.

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

export async function confirmarCarteiraAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<CarteiraConfirmada>> {
  try {
    await exigirPermissao({ modulo: "frota", acao: "editar" });
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
  const dados = esquemaConfirmarCarteira.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() !== "banco") {
    return erroDaAcao("entrada_invalida", {
      mensagem: "A Carteira grava só no banco. Rode o sistema com os dados do banco.",
    });
  }
  let resultado: ResultadoDaAcao<CarteiraConfirmada>;
  try {
    resultado = await gravarConfirmacaoDaCarteira(dados.data, envelope.data.chaveDeEnvio);
  } catch (erro) {
    console.error("confirmar a carteira falhou:", erro);
    return erroDaAcao("falha");
  }
  if (resultado.ok) revalidatePath("/frota/carteira");
  return resultado;
}
