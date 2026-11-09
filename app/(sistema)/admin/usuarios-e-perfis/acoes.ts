"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ClienteDeCadastros } from "@/lib/dados/catalogos-cadastro";
import { modoDosDados } from "@/lib/dados/fonte";
import { type AcessoGravado, mudarAcesso } from "@/lib/dados/usuarios-e-perfis";
import { esquemaMudarAcesso } from "@/lib/dominio/esquemas/cadastro";
import { ErroDePermissao, ErroDeSessao, exigirPermissao } from "@/lib/seguranca/exigir-permissao";
import { obterPessoaDaSessao } from "@/lib/seguranca/sessao-do-servidor";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// A Server Action de Administração › Usuários e perfis: fina. Confere a permissão (admin.editar), o
// envelope e os dados com o MESMO esquema da tela (Zod), grava com a sessão de quem usa (a RLS deixa
// só o Administrador gravar) e, só se gravou, invalida a tela e o menu (o perfil muda o que se vê).

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

export async function mudarAcessoAcao(bruto: unknown): Promise<ResultadoDaAcao<AcessoGravado>> {
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
  const dados = esquemaMudarAcesso.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() === "exemplo") {
    return erroDaAcao("falha", {
      mensagem: "Os usuários só gravam no banco. Abra o sistema com o banco local ligado.",
    });
  }
  let resultado: ResultadoDaAcao<AcessoGravado>;
  try {
    const pessoa = await obterPessoaDaSessao();
    if (!pessoa) {
      return erroDaAcao("sem_permissao", {
        mensagem: "Seu login não tem uma pessoa ligada. Peça a quem administra o acesso.",
      });
    }
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeCadastros;
    resultado = await mudarAcesso(cliente, dados.data, pessoa.pessoaId);
  } catch (erro) {
    console.error("mudança de acesso falhou:", erro);
    return erroDaAcao("falha");
  }
  if (resultado.ok) {
    revalidatePath("/admin/usuarios-e-perfis");
    revalidatePath("/", "layout");
  }
  return resultado;
}
