import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import type {
  EntradaCadastrarPlaca,
  EntradaDisponibilizacao,
  EntradaItemDeCatalogo,
  EntradaRecebimento,
} from "@/lib/dominio/esquemas/placa";
import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import type { ResultadoDaAcao } from "@/lib/wizard/resultado";
import type {
  AtualDaAcao,
  CandidatoDoConjunto,
  Catalogos,
  ItemCriado,
  PlacaGravada,
} from "./escrita-tipos";
import type {
  DetalheDaPlaca,
  FichaDaPlaca,
  OpcoesDaConsulta,
  PaginaDePlacas,
} from "./placas-tipos";

export const MENSAGEM_SO_COM_EXEMPLO = "A fonte de exemplo só roda com EIXO_DADOS=exemplo";

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

/**
 * Escolhe de onde vêm as placas. Hoje só existe a fonte de exemplo, e só com `EIXO_DADOS=exemplo`
 * (nunca definida na Vercel). A fonte do banco entra na Fase 3, e só este arquivo muda.
 */
export async function fonteDePlacas(): Promise<FonteDePlacas> {
  if (process.env.EIXO_DADOS !== "exemplo") {
    throw new Error(`${MENSAGEM_SO_COM_EXEMPLO}; a fonte do banco entra na Fase 3.`);
  }
  const { fonteDeExemplo } = await import("./fonte-de-exemplo");
  return fonteDeExemplo;
}

/**
 * A escrita das placas: o que os assistentes gravam e o que eles leem para se montar. Cada gravação
 * recebe a chave de envio (a mesma chave grava uma vez só) e devolve sempre a linha ou um erro tipado.
 * `agora` é `aaaa-mm-ddThh:mm` em São Paulo.
 */
export interface FonteDeEscrita {
  cadastrarPlaca(
    entrada: EntradaCadastrarPlaca,
    chave: string,
    agora: string,
  ): Promise<ResultadoDaAcao<PlacaGravada, AtualDaAcao>>;
  disponibilizarPlaca(
    entrada: EntradaDisponibilizacao,
    chave: string,
    agora: string,
  ): Promise<ResultadoDaAcao<PlacaGravada, AtualDaAcao>>;
  receberPlaca(
    entrada: EntradaRecebimento,
    chave: string,
    agora: string,
    gestorId: string,
  ): Promise<ResultadoDaAcao<PlacaGravada, AtualDaAcao>>;
  criarItemDeCatalogo(
    entrada: EntradaItemDeCatalogo,
    chave: string,
  ): Promise<ResultadoDaAcao<ItemCriado, AtualDaAcao>>;
  catalogos(): Promise<Catalogos>;
  /** A placa com a versão que a pessoa vê (edição concorrente), ou `null` se não existe. */
  placaParaAssistente(placa: string): Promise<PlacaGravada | null>;
  pedidoPendenteDa(placa: string): Promise<PedidoDeTransferencia | null>;
  pedidosPendentes(): Promise<PedidoDeTransferencia[]>;
  candidatosDoConjunto(placa: string): Promise<CandidatoDoConjunto[]>;
  /** As placas em PÁT, VAz ou ETv (o assistente aberto sem placa escolhida oferece estas). */
  placasQuePodemSerDisponibilizadas(): Promise<{ placa: string; nome: string }[]>;
}

/** Escolhe onde se grava. Igual à leitura: só a fonte de exemplo, e só com `EIXO_DADOS=exemplo`. */
export async function fonteDeEscrita(hoje: string): Promise<FonteDeEscrita> {
  if (process.env.EIXO_DADOS !== "exemplo") {
    throw new Error(`${MENSAGEM_SO_COM_EXEMPLO}; a fonte do banco entra na Fase 3.`);
  }
  const { escritaDeExemplo } = await import("./fonte-de-exemplo");
  return escritaDeExemplo(hoje);
}
