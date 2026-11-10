"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { modoDosDados } from "@/lib/dados/fonte";
import { type ClienteDasPessoas, type MarcacaoGravada, marcarEscala } from "@/lib/dados/pessoas";
import { esquemaMarcarEscala } from "@/lib/dominio/esquemas/pessoa";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// A Server Action do mini-assistente "Marcar dia" da Escala: fina. Confere a permissão (Pessoas ›
// editar; o Operacional da filial passa por Operacional › editar, e o banco confere a filial), o
// envelope e os dados com o MESMO esquema da tela, grava pela função do banco (alcance, vínculo do dia
// e versão conferidos lá) e, só se gravou, invalida a escala e a ficha da pessoa.

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

async function negado() {
  try {
    await exigirPermissao({ modulo: "pessoas", acao: "editar" });
    return null;
  } catch (erro) {
    if (erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    if (!(erro instanceof ErroDePermissao)) throw erro;
  }
  try {
    await exigirPermissao({ modulo: "operacional", acao: "editar" });
    return null;
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    throw erro;
  }
}

export async function marcarEscalaAcao(bruto: unknown): Promise<ResultadoDaAcao<MarcacaoGravada>> {
  const sem = await negado();
  if (sem) return sem;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success) {
    return erroDaAcao("entrada_invalida", {
      mensagem: "O envio chegou incompleto. Feche o assistente, abra de novo e tente outra vez.",
    });
  }
  const dados = esquemaMarcarEscala.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() === "exemplo") {
    return erroDaAcao("falha", {
      mensagem: "A escala só grava no banco. Abra o sistema com o banco local ligado.",
    });
  }
  let resultado: ResultadoDaAcao<MarcacaoGravada>;
  try {
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDasPessoas;
    resultado = await marcarEscala(cliente, dados.data);
  } catch (erro) {
    console.error("marcação da escala falhou:", erro instanceof Error ? erro.name : "erro");
    return erroDaAcao("falha");
  }
  if (resultado.ok) {
    revalidatePath("/pessoas/escala");
    revalidatePath(`/pessoas/lista/${dados.data.pessoaId}`);
  }
  return resultado;
}
