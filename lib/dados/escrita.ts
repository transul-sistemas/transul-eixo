import { z } from "zod";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import {
  esquemaCadastrarPlaca,
  esquemaConcluirRecebimento,
  esquemaDisponibilizarPlaca,
  esquemaEntregaAoOperacionalDe,
  esquemaItemDeCatalogo,
  esquemaReceberPlaca,
} from "@/lib/dominio/esquemas/placa";
import { normalizarPlaca } from "@/lib/dominio/placa";
import { chaveDeEnvioValida } from "@/lib/wizard/chave-de-envio";
import { erroDaAcao, errosDeCampos, type ResultadoDaAcao } from "@/lib/wizard/resultado";
import type { AtualDaAcao, ItemCriado, PlacaGravada } from "./escrita-tipos";
import type { FonteDeEscrita } from "./fonte";

// O miolo das Server Actions de escrita da Frota: valida a entrada com o MESMO esquema Zod da tela,
// confere a chave de envio, chama a fonte e devolve sempre a linha ou um erro tipado (nunca lança).
// A permissão e a invalidação do cache ficam na Server Action (app/(sistema)/frota/placas/acoes.ts).

export interface ContextoDaEscrita {
  fonte: FonteDeEscrita;
  /** `aaaa-mm-ddThh:mm` em São Paulo. */
  agora: string;
  /** `aaaa-mm-dd` em São Paulo. */
  hoje: string;
  /** O gestor de frota de quem grava (só o gestor de destino recebe e conclui um pedido). */
  gestorId: string;
}

type Resultado<T> = ResultadoDaAcao<T, AtualDaAcao>;

const SO_A_PLACA = z.looseObject({ placa: z.string() });

/** A chave de envio conferida; devolve o erro pronto se não é um UUID. */
function conferirChave(chave: string): Resultado<never> | null {
  return chaveDeEnvioValida(chave)
    ? null
    : erroDaAcao("entrada_invalida", {
        mensagem: "O envio chegou sem a chave de conferência. Feche e abra o assistente de novo.",
      });
}

type Validacao<T> = { ok: true; dados: T } | { ok: false; erro: Resultado<never> };

function validar<T>(
  esquema: {
    safeParse: (
      entrada: unknown,
    ) => { success: true; data: T } | { success: false; error: z.ZodError };
  },
  dados: unknown,
): Validacao<T> {
  const r = esquema.safeParse(dados);
  return r.success
    ? { ok: true, dados: r.data }
    : { ok: false, erro: erroDaAcao("entrada_invalida", { campos: errosDeCampos(r.error) }) };
}

/** Roda a gravação; falha da fonte vira `falha` (a causa fica no registro do servidor, não na tela). */
async function gravando<T>(gravar: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
  try {
    return await gravar();
  } catch (erro) {
    console.error("escrita falhou:", erro);
    return erroDaAcao("falha");
  }
}

export async function executarCadastrarPlaca(
  chave: string,
  dados: unknown,
  { fonte, agora, hoje }: ContextoDaEscrita,
): Promise<Resultado<PlacaGravada>> {
  const semChave = conferirChave(chave);
  if (semChave) return semChave;
  const v = validar(esquemaCadastrarPlaca({ anoAtual: Number(hoje.slice(0, 4)), hoje }), dados);
  if (!v.ok) return v.erro;
  return gravando(() => fonte.cadastrarPlaca(v.dados, chave, agora));
}

/**
 * O esquema da entrega ao Operacional depende do tipo da placa (só cavalo e caminhão), então a placa é
 * lida antes. A situação de origem fica com a fonte, que confere a versão primeiro.
 */
export async function executarEntregarAoOperacional(
  chave: string,
  dados: unknown,
  { fonte, agora }: ContextoDaEscrita,
): Promise<Resultado<PlacaGravada>> {
  const semChave = conferirChave(chave);
  if (semChave) return semChave;
  const aPlaca = validar(SO_A_PLACA, dados);
  if (!aPlaca.ok) return aPlaca.erro;
  return gravando(async () => {
    const atual = await fonte.placaParaAssistente(normalizarPlaca(aPlaca.dados.placa));
    if (!atual) return erroDaAcao("nao_encontrado");
    const v = validar(esquemaEntregaAoOperacionalDe({ tipo: atual.tipo }), dados);
    if (!v.ok) return v.erro;
    return fonte.entregarAoOperacional(v.dados, chave, agora);
  });
}

/** Disponibilizar placa: o envio a outro gestor de frota, com motivo e pendências. */
export async function executarDisponibilizarPlaca(
  chave: string,
  dados: unknown,
  { fonte, agora }: ContextoDaEscrita,
): Promise<Resultado<PedidoDeTransferencia>> {
  const semChave = conferirChave(chave);
  if (semChave) return semChave;
  const v = validar(esquemaDisponibilizarPlaca, dados);
  if (!v.ok) return v.erro;
  return gravando(() => fonte.disponibilizarPlaca(v.dados, chave, agora));
}

/** Receber placa: a primeira etapa, que registra a chegada (o gestor não muda). */
export async function executarReceber(
  chave: string,
  dados: unknown,
  { fonte, agora, gestorId }: ContextoDaEscrita,
): Promise<Resultado<PedidoDeTransferencia>> {
  const semChave = conferirChave(chave);
  if (semChave) return semChave;
  const v = validar(esquemaReceberPlaca, dados);
  if (!v.ok) return v.erro;
  return gravando(() => fonte.receberPlaca(v.dados, chave, agora, gestorId));
}

/** Concluir recebimento: responde cada pendência e troca o gestor. */
export async function executarConcluirRecebimento(
  chave: string,
  dados: unknown,
  { fonte, agora, gestorId }: ContextoDaEscrita,
): Promise<Resultado<PlacaGravada>> {
  const semChave = conferirChave(chave);
  if (semChave) return semChave;
  const v = validar(esquemaConcluirRecebimento, dados);
  if (!v.ok) return v.erro;
  return gravando(() => fonte.concluirRecebimento(v.dados, chave, agora, gestorId));
}

export async function executarCriarItemDeCatalogo(
  chave: string,
  dados: unknown,
  { fonte }: ContextoDaEscrita,
): Promise<Resultado<ItemCriado>> {
  const semChave = conferirChave(chave);
  if (semChave) return semChave;
  const v = validar(esquemaItemDeCatalogo, dados);
  if (!v.ok) return v.erro;
  return gravando(() => fonte.criarItemDeCatalogo(v.dados, chave));
}
