"use server";

import { textoDoErro } from "@/lib/log/erro";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  arquivarItem,
  type ClienteDeCadastros,
  editarItem,
  incluirItem,
  type ItemGravado,
} from "@/lib/dados/catalogos-cadastro";
import { modoDosDados } from "@/lib/dados/fonte";
import {
  esquemaArquivarItem,
  esquemaEditarItem,
  esquemaIncluirItem,
} from "@/lib/dominio/esquemas/cadastro";
import {
  ErroDePermissao,
  ErroDeSessao,
  exigirPermissao,
  type Permissao,
} from "@/lib/seguranca/exigir-permissao";
import { obterPessoaDaSessao } from "@/lib/seguranca/sessao-do-servidor";
import { criarClienteDoServidor } from "@/lib/supabase/servidor";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";

// As Server Actions de Cadastros › Catálogos: finas. Conferem a permissão (`exigirPermissao`) e o
// envelope e os dados com o MESMO esquema da tela (Zod), gravam com a sessão de quem usa (a RLS repete
// a regra no banco) e, só se gravou, invalidam a tela. Devolvem a linha ou um erro tipado; nunca lançam.
// Incluir pede cadastros.criar; editar, cadastros.editar; arquivar, cadastros.excluir.

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });
const ROTA = "/cadastros/catalogos";

type Resultado = ResultadoDaAcao<ItemGravado>;

async function executar<E>(
  bruto: unknown,
  esquema: z.ZodType<E>,
  permissao: Permissao,
  gravar: (cliente: ClienteDeCadastros, entrada: E) => Promise<Resultado>,
): Promise<Resultado> {
  try {
    await exigirPermissao(permissao);
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
  const dados = esquema.safeParse(envelope.data.dados);
  if (!dados.success) return erroDaAcao("entrada_invalida", { campos: errosDeCampos(dados.error) });
  if (modoDosDados() === "exemplo") {
    return erroDaAcao("falha", {
      mensagem: "Os catálogos só gravam no banco. Abra o sistema com o banco local ligado.",
    });
  }
  let resultado: Resultado;
  try {
    const cliente = (await criarClienteDoServidor()) as unknown as ClienteDeCadastros;
    resultado = await gravar(cliente, dados.data);
  } catch (erro) {
    console.error("gravação do catálogo falhou:", textoDoErro(erro));
    return erroDaAcao("falha");
  }
  if (resultado.ok) {
    revalidatePath(ROTA);
    // Os catálogos alimentam a lista e os assistentes da Frota.
    revalidatePath("/frota/placas");
  }
  return resultado;
}

export async function incluirItemAcao(bruto: unknown) {
  return executar(bruto, esquemaIncluirItem, { modulo: "cadastros", acao: "criar" }, incluirItem);
}

export async function editarItemAcao(bruto: unknown) {
  return executar(bruto, esquemaEditarItem, { modulo: "cadastros", acao: "editar" }, editarItem);
}

export async function arquivarItemAcao(bruto: unknown) {
  return executar(
    bruto,
    esquemaArquivarItem,
    { modulo: "cadastros", acao: "excluir" },
    async (cliente, entrada) => {
      const pessoa = await obterPessoaDaSessao();
      if (!pessoa) {
        return erroDaAcao("sem_permissao", {
          mensagem: "Seu login não tem uma pessoa ligada. Peça a quem administra o acesso.",
        });
      }
      return arquivarItem(cliente, entrada, pessoa.pessoaId, new Date().toISOString());
    },
  );
}
