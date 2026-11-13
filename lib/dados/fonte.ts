import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import type {
  EntradaCadastrarPlaca,
  EntradaCancelarPedido,
  EntradaConcluirRecebimento,
  EntradaDevolverPlaca,
  EntradaDisponibilizarPlaca,
  EntradaEntregaAoOperacional,
  EntradaItemDeCatalogo,
  EntradaReceberPlaca,
  TipoDeItemDeCatalogo,
} from "@/lib/dominio/esquemas/placa";
import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import type { ResultadoDaAcao } from "@/lib/wizard/resultado";
import type {
  EntradaCorrigirPlaca,
  EntradaDesatrelar,
  EntradaEngatar,
  EntradaMudarSituacao,
} from "@/lib/dominio/esquemas/ficha-da-placa";
import type {
  AtualDaAcao,
  Catalogos,
  ConjuntoDaPlaca,
  ItemCriado,
  PlacaAEscolher,
  PlacaGravada,
} from "./escrita-tipos";
import type {
  DetalheDaPlaca,
  FichaDaPlaca,
  OpcoesDaConsulta,
  PaginaDePlacas,
} from "./placas-tipos";

export const MENSAGEM_SO_COM_EXEMPLO = "A fonte de exemplo só roda com EIXO_DADOS=exemplo";

/**
 * De onde vêm os dados: o exemplo só com `EIXO_DADOS=exemplo` (desenvolvimento rápido e os e2e
 * atuais); fora disso, sempre o banco. Em produção a variável nunca existe, então é sempre o banco.
 */
export function modoDosDados(): "exemplo" | "banco" {
  return process.env.EIXO_DADOS === "exemplo" ? "exemplo" : "banco";
}

export interface FonteDePlacas {
  consultar(
    consulta: ConsultaDeTabela,
    hoje: string,
    opcoes: OpcoesDaConsulta,
  ): Promise<PaginaDePlacas>;
  /** A placa já normalizada (maiúscula, só letras e números), ou `null` se não existe. */
  obter(placa: string, hoje: string, opcoes: OpcoesDaConsulta): Promise<DetalheDaPlaca | null>;
  /** A ficha: o detalhe e a história. A placa já normalizada; `null` se não existe. */
  obterFicha(placa: string, hoje: string, opcoes: OpcoesDaConsulta): Promise<FichaDaPlaca | null>;
}

/** Escolhe de onde vêm as placas: o exemplo, ou o banco com a sessão de quem usa (RLS). */
export async function fonteDePlacas(): Promise<FonteDePlacas> {
  if (modoDosDados() === "banco") {
    const [{ fonteDoBanco }, { criarClienteDoServidor }] = await Promise.all([
      import("./fonte-do-banco"),
      import("@/lib/supabase/servidor"),
    ]);
    return fonteDoBanco(criarClienteDoServidor);
  }
  const { fonteDeExemplo } = await import("./fonte-de-exemplo");
  return fonteDeExemplo;
}

type Gravacao<T> = Promise<ResultadoDaAcao<T, AtualDaAcao>>;

/**
 * A escrita das placas: o que os assistentes gravam e o que eles leem para se montar. Cada gravação
 * recebe a chave de envio (a mesma chave grava uma vez só) e devolve sempre a linha ou um erro tipado.
 * `agora` é `aaaa-mm-ddThh:mm` em São Paulo (o banco usa o relógio dele). `gestorId` é a pessoa de
 * quem usa (só o destinatário recebe e conclui).
 */
export interface FonteDeEscrita {
  cadastrarPlaca(
    entrada: EntradaCadastrarPlaca,
    chave: string,
    agora: string,
  ): Gravacao<PlacaGravada>;
  entregarAoOperacional(
    entrada: EntradaEntregaAoOperacional,
    chave: string,
    agora: string,
  ): Gravacao<PlacaGravada>;
  disponibilizarPlaca(
    entrada: EntradaDisponibilizarPlaca,
    chave: string,
    agora: string,
  ): Gravacao<PedidoDeTransferencia>;
  receberPlaca(
    entrada: EntradaReceberPlaca,
    chave: string,
    agora: string,
    gestorId: string,
  ): Gravacao<PedidoDeTransferencia>;
  concluirRecebimento(
    entrada: EntradaConcluirRecebimento,
    chave: string,
    agora: string,
    gestorId: string,
  ): Gravacao<PlacaGravada>;
  /** Mudar situação: um evento de status com data e hora (a placa solta ou o conjunto). */
  mudarSituacao(
    entrada: EntradaMudarSituacao,
    chave: string,
    agora: string,
  ): Gravacao<PlacaGravada>;
  /** Engatar um implemento no cavalo; devolve o cavalo. */
  engatar(entrada: EntradaEngatar, chave: string, agora: string): Gravacao<PlacaGravada>;
  /** Desatrelar implementos do cavalo; devolve o cavalo. */
  desatrelar(entrada: EntradaDesatrelar, chave: string, agora: string): Gravacao<PlacaGravada>;
  /** Completar o RENAVAM e o número de série; corrigir eixos e carroceria, com o motivo. */
  corrigirPlaca(
    entrada: EntradaCorrigirPlaca,
    chave: string,
    agora: string,
  ): Gravacao<PlacaGravada>;
  /** O conjunto da placa (com o nome pela nomenclatura), ou `null` se ela não está em conjunto. */
  conjuntoDaPlaca(placa: string): Promise<ConjuntoDaPlaca | null>;
  /** Os implementos soltos (sem cavalo) que podem ser engatados. */
  implementosLivres(): Promise<PlacaAEscolher[]>;
  /** Os cavalos não baixados que podem receber implementos (engatar pela aba Soltas). */
  cavalosParaEngatar(): Promise<PlacaAEscolher[]>;
  /** A origem desiste do pedido pendente; devolve o pedido já cancelado. */
  cancelarPedido(
    entrada: EntradaCancelarPedido,
    chave: string,
    agora: string,
    gestorId: string,
  ): Gravacao<PedidoDeTransferencia>;
  /** O destino recusa o pedido em conferência; devolve o pedido já devolvido. */
  devolverPlaca(
    entrada: EntradaDevolverPlaca,
    chave: string,
    agora: string,
    gestorId: string,
  ): Gravacao<PedidoDeTransferencia>;
  criarItemDeCatalogo(entrada: EntradaItemDeCatalogo, chave: string): Gravacao<ItemCriado>;
  /** Os tipos que o "+" cria nesta fonte. */
  readonly criaveis: readonly TipoDeItemDeCatalogo[];
  catalogos(): Promise<Catalogos>;
  /** A placa com a versão que a pessoa vê (edição concorrente), ou `null` se não existe. */
  placaParaAssistente(placa: string): Promise<PlacaGravada | null>;
  /** O pedido aberto (pendente ou em conferência) da placa, ou `null`. */
  pedidoAbertoDa(placa: string): Promise<PedidoDeTransferencia | null>;
  /** Os pedidos abertos para o gestor (as duas etapas). */
  pedidosParaReceber(gestorId: string): Promise<PedidoDeTransferencia[]>;
  /** As placas em PÁT ou ETv que podem ir ao Operacional. */
  placasQuePodemSerEntregues(): Promise<PlacaAEscolher[]>;
}

/** Escolhe onde se grava: o exemplo, ou o banco com a sessão de quem usa (RLS e funções atômicas). */
export async function fonteDeEscrita(hoje: string): Promise<FonteDeEscrita> {
  if (modoDosDados() === "banco") {
    const [{ escritaDoBanco }, { criarClienteDoServidor }] = await Promise.all([
      import("./escrita-do-banco"),
      import("@/lib/supabase/servidor"),
    ]);
    return escritaDoBanco(criarClienteDoServidor);
  }
  const { escritaDeExemplo } = await import("./fonte-de-exemplo");
  return await escritaDeExemplo(hoje);
}

/** Quantas placas esperam por quem usa (as duas etapas do recebimento): o selo, a faixa e o chip. */
export async function contarParaReceber(hoje: string): Promise<number> {
  if (modoDosDados() === "banco") {
    const [{ contarParaReceberNoBanco }, { criarClienteDoServidor }] = await Promise.all([
      import("./escrita-do-banco"),
      import("@/lib/supabase/servidor"),
    ]);
    return contarParaReceberNoBanco(await criarClienteDoServidor());
  }
  const { contarParaReceberNoExemplo } = await import("./fonte-de-exemplo");
  return contarParaReceberNoExemplo(hoje);
}
