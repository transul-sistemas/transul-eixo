"use server";

import { textoDoErro } from "@/lib/log/erro";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { modoDosDados } from "@/lib/dados/fonte";
import {
  type ClienteDoCorte,
  esquemaDiaDoCorte,
  gravarDiaDoCorte,
} from "@/lib/dados/parametro-do-corte";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// A Server Action do dia do corte: confere a permissão (Administração › editar, a mesma regra da RLS do
// parâmetro) e a entrada (Zod), e recusa no servidor enquanto o staging das despesas não tem a DTNEG
// (o gatilho do banco repete a recusa). Só se gravou, invalida a tela. Nunca lança.

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });
const ROTA = "/cadastros/catalogos";

export async function editarDiaDoCorte(
  bruto: unknown,
): Promise<ResultadoDaAcao<{ chave: string; valor: string }>> {
  try {
    await exigirPermissao({ modulo: "admin", acao: "editar" });
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
  const dados = esquemaDiaDoCorte.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() === "exemplo") {
    return erroDaAcao("falha", {
      mensagem: "O parâmetro só grava no banco. Abra o sistema com o banco local ligado.",
    });
  }
  let resultado: ResultadoDaAcao<{ chave: string; valor: string }>;
  try {
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDoCorte;
    resultado = await gravarDiaDoCorte(cliente, dados.data);
  } catch (erro) {
    console.error("gravação do dia do corte falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
