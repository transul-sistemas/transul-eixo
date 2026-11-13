"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hojeEmSaoPaulo } from "@/components/formato/data";
import { gravarPeloPainel } from "@/lib/dados/paineis";
import {
  ASSISTENTES_DOS_PAINEIS,
  ESQUEMAS_DOS_PAINEIS,
  type IdDoAssistenteDoPainel,
} from "@/lib/dominio/esquemas/paineis";
import { textoDoErro } from "@/lib/log/erro";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { chaveDeEnvioValida } from "@/lib/wizard/chave-de-envio";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// A gravação dos assistentes das telas de painel (Fechar e Reabrir o mês, Pedir ajuste, Registrar o
// status do dia, Indicar substituto, Lançar abastecimento): confere a permissão no banco, valida o
// envelope e os dados com o MESMO esquema da tela (Zod), grava pela função atômica (chave de envio) e
// invalida as telas afetadas.

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });
const ID = z.enum(Object.keys(ESQUEMAS_DOS_PAINEIS) as [IdDoAssistenteDoPainel]);

export async function gravarAssistenteDoPainelAcao(
  idBruto: unknown,
  bruto: unknown,
): Promise<ResultadoDaAcao<unknown>> {
  const id = ID.safeParse(idBruto);
  if (!id.success) return erroDaAcao("entrada_invalida", { mensagem: "Assistente desconhecido." });
  const info = ASSISTENTES_DOS_PAINEIS[id.data];
  try {
    await exigirPermissao(info.permissao);
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
  const dados = ESQUEMAS_DOS_PAINEIS[id.data].safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  let resultado: ResultadoDaAcao<unknown>;
  try {
    resultado = await gravarPeloPainel(
      id.data,
      dados.data as Record<string, unknown>,
      envelope.data.chaveDeEnvio,
      hojeEmSaoPaulo(new Date()),
    );
  } catch (erro) {
    console.error(`${info.titulo} falhou:`, textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) for (const rota of info.rotas) revalidatePath(rota);
  return resultado;
}
