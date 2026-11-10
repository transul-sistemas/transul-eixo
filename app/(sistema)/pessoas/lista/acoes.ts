"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { modoDosDados } from "@/lib/dados/fonte";
import {
  cadastrarPessoa,
  type ClienteDasPessoas,
  editarPessoa,
  type PessoaGravada,
} from "@/lib/dados/pessoas";
import { esquemaCadastrarPessoa, esquemaEditarPessoa } from "@/lib/dominio/esquemas/pessoa";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// As Server Actions dos assistentes "Cadastrar pessoa" e "Editar pessoa": finas. Conferem a permissão
// (Pessoas › criar ou editar), o envelope e os dados com o MESMO esquema da tela (Zod), gravam com a
// sessão de quem usa (o banco confere de novo: CPF, duplicata, vínculo, versão) e, só se gravou,
// invalidam a lista, a ficha e a escala. Devolvem a linha ou um erro tipado.

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

const SO_NO_BANCO = "As pessoas só gravam no banco. Abra o sistema com o banco local ligado.";

async function conferir(acao: "criar" | "editar") {
  try {
    await exigirPermissao({ modulo: "pessoas", acao });
    return null;
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    throw erro;
  }
}

const envelopeIncompleto = () =>
  erroDaAcao("entrada_invalida", {
    mensagem: "O envio chegou incompleto. Feche o assistente, abra de novo e tente outra vez.",
  });

function invalidar(id?: string) {
  revalidatePath("/pessoas/lista");
  if (id) revalidatePath(`/pessoas/lista/${id}`);
  revalidatePath("/pessoas/escala");
}

export async function cadastrarPessoaAcao(bruto: unknown): Promise<ResultadoDaAcao<PessoaGravada>> {
  const negado = await conferir("criar");
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success) return envelopeIncompleto();
  const dados = esquemaCadastrarPessoa.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() === "exemplo") return erroDaAcao("falha", { mensagem: SO_NO_BANCO });
  let resultado: ResultadoDaAcao<PessoaGravada>;
  try {
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDasPessoas;
    resultado = await cadastrarPessoa(cliente, dados.data);
  } catch (erro) {
    console.error("cadastro da pessoa falhou:", erro instanceof Error ? erro.name : "erro");
    return erroDaAcao("falha");
  }
  if (resultado.ok) invalidar(resultado.linha.id);
  return resultado;
}

export async function editarPessoaAcao(bruto: unknown): Promise<ResultadoDaAcao<PessoaGravada>> {
  const negado = await conferir("editar");
  if (negado) return negado;
  const envelope = ENVELOPE.safeParse(bruto);
  if (!envelope.success) return envelopeIncompleto();
  const dados = esquemaEditarPessoa.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() === "exemplo") return erroDaAcao("falha", { mensagem: SO_NO_BANCO });
  let resultado: ResultadoDaAcao<PessoaGravada>;
  try {
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDasPessoas;
    resultado = await editarPessoa(cliente, dados.data);
  } catch (erro) {
    console.error("edição da pessoa falhou:", erro instanceof Error ? erro.name : "erro");
    return erroDaAcao("falha");
  }
  if (resultado.ok) invalidar(dados.data.id);
  return resultado;
}
