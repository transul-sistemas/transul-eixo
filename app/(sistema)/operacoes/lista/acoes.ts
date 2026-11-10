"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type ClienteDasOperacoes,
  editarOperacao,
  type OperacaoGravada,
} from "@/lib/dados/operacoes";
import { modoDosDados } from "@/lib/dados/fonte";
import { esquemaEditarOperacao } from "@/lib/dominio/esquemas/operacao";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// A Server Action do assistente "Editar operação": fina. Confere a permissão (Operações › editar), o
// envelope e os dados com o MESMO esquema da tela (Zod), grava com a sessão de quem usa (a RLS repete
// a regra no banco) e, só se gravou, invalida a lista e a ficha. Devolve a linha ou um erro tipado.

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

export async function editarOperacaoAcao(
  bruto: unknown,
): Promise<ResultadoDaAcao<OperacaoGravada>> {
  try {
    await exigirPermissao({ modulo: "operacoes", acao: "editar" });
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
  const dados = esquemaEditarOperacao.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() === "exemplo") {
    return erroDaAcao("falha", {
      mensagem: "As operações só gravam no banco. Abra o sistema com o banco local ligado.",
    });
  }
  let resultado: ResultadoDaAcao<OperacaoGravada>;
  try {
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDasOperacoes;
    resultado = await editarOperacao(cliente, dados.data);
  } catch (erro) {
    console.error("gravação da operação falhou:", erro);
    return erroDaAcao("falha");
  }
  if (resultado.ok) {
    revalidatePath("/operacoes/lista");
    revalidatePath(`/operacoes/lista/${dados.data.id}`);
    // O nome da operação aparece também na lista e na ficha das placas e nos catálogos.
    revalidatePath("/frota/placas");
    revalidatePath("/cadastros/catalogos");
  }
  return resultado;
}
