import { revalidatePath } from "next/cache";
import { z } from "zod";
import { textoDoErro } from "@/lib/log/erro";
import {
  ErroDePermissao,
  ErroDeSessao,
  exigirPermissao,
  type Permissao,
} from "@/lib/seguranca/exigir-permissao";
import { chaveDeEnvioValida } from "@/lib/wizard/chave-de-envio";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { modoDosDados } from "./fonte";

// O miolo comum das Server Actions que só gravam no banco (A2, Trocar CR, Baixa, Saúde do CR): confere a
// permissão, abre o envelope (chave de envio), chama a função atômica com a sessão de quem usa, devolve
// sempre a linha ou um erro tipado (nunca lança) e invalida as telas afetadas. Cada Server Action valida
// os dados com o seu esquema Zod (o MESMO da tela) antes de chamar `noBanco`.

export const SO_NO_BANCO =
  "Esta ação grava só no banco. Rode o sistema com os dados do banco para usá-la.";

/** Confere a permissão; devolve o erro pronto, ou nulo se pode. */
export async function semPermissao(p: Permissao): Promise<ResultadoDaAcao<never> | null> {
  try {
    await exigirPermissao(p);
    return null;
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return erroDaAcao("sem_permissao", { mensagem: erro.message });
    throw erro;
  }
}

const ENVELOPE = z.object({ chaveDeEnvio: z.string(), dados: z.unknown() });

export type Envelope =
  { ok: true; chave: string; dados: unknown } | { ok: false; erro: ResultadoDaAcao<never> };

export function abrirEnvelope(bruto: unknown): Envelope {
  const e = ENVELOPE.safeParse(bruto);
  if (!e.success || !chaveDeEnvioValida(e.data.chaveDeEnvio)) {
    return {
      ok: false,
      erro: erroDaAcao("entrada_invalida", {
        mensagem: "O envio chegou incompleto. Feche o assistente, abra de novo e tente outra vez.",
      }) as ResultadoDaAcao<never>,
    };
  }
  return { ok: true, chave: e.data.chaveDeEnvio, dados: e.data.dados };
}

type Validacao<T> = { success: true; data: T } | { success: false; error: z.ZodError };

/**
 * Permissão, envelope e dados, nesta ordem. Quem chama passa a conferência (`exigirPermissao`) e a
 * validação (`esquema.safeParse`) do seu esquema, para cada Server Action dizer as duas por escrito.
 */
export async function prepararAcao<T>(
  conferir: () => Promise<unknown>,
  bruto: unknown,
  validar: (dados: unknown) => Validacao<T>,
): Promise<{ ok: true; chave: string; dados: T } | { ok: false; erro: ResultadoDaAcao<never> }> {
  try {
    await conferir();
  } catch (erro) {
    if (erro instanceof ErroDePermissao || erro instanceof ErroDeSessao)
      return {
        ok: false,
        erro: erroDaAcao("sem_permissao", { mensagem: erro.message }) as ResultadoDaAcao<never>,
      };
    throw erro;
  }
  const envelope = abrirEnvelope(bruto);
  if (!envelope.ok) return envelope;
  const dados = validar(envelope.dados);
  if (!dados.success) {
    return {
      ok: false,
      erro: erroDaAcao("entrada_invalida", {
        campos: errosDeCampos(dados.error),
      }) as ResultadoDaAcao<never>,
    };
  }
  return { ok: true, chave: envelope.chave, dados: dados.data };
}

async function clienteDaSessao(): Promise<ClienteDeEscrita> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDeEscrita;
}

/** Grava pelo banco; só se gravou, invalida os caminhos. Falha vira `falha` (a causa fica no log). */
export async function noBanco<T>(
  rotulo: string,
  fazer: (cliente: ClienteDeEscrita) => Promise<ResultadoDaAcao<T>>,
  caminhos: readonly string[],
): Promise<ResultadoDaAcao<T>> {
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_NO_BANCO });
  try {
    const r = await fazer(await clienteDaSessao());
    if (r.ok) for (const c of caminhos) revalidatePath(c);
    return r;
  } catch (erro) {
    console.error(`${rotulo} falhou:`, textoDoErro(erro));
    return erroDaAcao("falha");
  }
}

/** Lê pelo banco (para um popup que precisa de um dado na hora); falha vira `falha`. */
export async function lerNoBanco<T>(
  rotulo: string,
  ler: (cliente: ClienteDeEscrita) => Promise<T>,
): Promise<ResultadoDaAcao<T>> {
  if (modoDosDados() !== "banco") return erroDaAcao("entrada_invalida", { mensagem: SO_NO_BANCO });
  try {
    return sucesso(await ler(await clienteDaSessao()));
  } catch (erro) {
    console.error(`${rotulo} falhou:`, textoDoErro(erro));
    return erroDaAcao("falha");
  }
}
