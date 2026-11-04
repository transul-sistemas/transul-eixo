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

/** As gravações no modo banco entram na 3.9b; até lá, a tela mostra o aviso e não grava. */
export const MENSAGEM_GRAVACAO_EM_BREVE =
  "Gravar pelo banco entra em breve. Por enquanto, as telas mostram os dados sem alterar.";

export class ErroDeGravacaoEmBreve extends Error {
  constructor() {
    super(MENSAGEM_GRAVACAO_EM_BREVE);
    this.name = "ErroDeGravacaoEmBreve";
  }
}

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
  /** As placas em PÁT ou ETv (o assistente aberto sem placa escolhida oferece estas). */
  placasQuePodemSerDisponibilizadas(): Promise<{ placa: string; nome: string }[]>;
}

/** Escolhe onde se grava: o exemplo; no modo banco, as gravações entram na 3.9b ("em breve"). */
export async function fonteDeEscrita(hoje: string): Promise<FonteDeEscrita> {
  if (modoDosDados() === "banco") throw new ErroDeGravacaoEmBreve();
  const { escritaDeExemplo } = await import("./fonte-de-exemplo");
  return await escritaDeExemplo(hoje);
}
