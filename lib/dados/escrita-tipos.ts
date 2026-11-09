import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import type { TipoDeItemDeCatalogo } from "@/lib/dominio/esquemas/placa";
import type { Sigla } from "@/lib/dominio/status";
import type { TipoDeAtivo } from "./placas-tipos";

// Os tipos que a escrita troca com a tela (o que as Server Actions devolvem e o que os assistentes
// recebem). Vivem aqui, e não em `lib/exemplo/`, porque o navegador pode importá-los: são só formas.

export interface OpcaoDoCatalogo {
  id: string;
  nome: string;
}
export interface ModeloDoCatalogo extends OpcaoDoCatalogo {
  marcaId: string;
}
export interface CrDoCatalogo {
  id: string;
  codigo: string;
  /** A operação do CR, quando o Sankhya diz; sem ela o CR serve a qualquer operação. */
  operacaoId: string | null;
}

export interface VigenciaDeGestor {
  gestorId: string;
  gestor: string;
  /** `aaaa-mm-ddThh:mm`; o intervalo é `[inicio, fim)`. */
  inicio: string;
  fim: string | null;
}

export interface VigenciaDeCr {
  codigo: string;
  nome: string;
  /** `aaaa-mm-dd`; o intervalo é `[inicio, fim)`. */
  inicio: string;
  fim: string | null;
}

export interface ValorDaPlaca {
  codigoFipe: string | null;
  valorFipeCentavos: number | null;
  valorManualCentavos: number | null;
  fonteDoValor: string | null;
  dataDoValor: string | null;
}

/** A placa como os assistentes a veem: o que a tela mostra mais a versão e o histórico de gestores. */
export interface PlacaGravada {
  placa: string;
  tipo: TipoDeAtivo;
  renavam: string;
  marcaId: string | null;
  marca: string | null;
  modeloId: string | null;
  modelo: string;
  ano: number | null;
  sigla: Sigla;
  /** Desde quando está nesta situação, `aaaa-mm-ddThh:mm`. */
  desde: string;
  gestorId: string | null;
  gestor: string;
  operacaoId: string | null;
  operacao: string | null;
  crId: string | null;
  crs: VigenciaDeCr[];
  /** A filial da custódia do Operacional (a garagem, uma das 3), se a placa está com ele. */
  filialId: string | null;
  filial: string;
  /** A garagem, que vem do CR (calculada). */
  garagem: string;
  valor: ValorDaPlaca;
  /** Sobe a cada mudança (edição concorrente). 0 quando quem vê não alcança o ativo (o destinatário). */
  versao: number;
  gestores: VigenciaDeGestor[];
}

export interface Catalogos {
  marcas: OpcaoDoCatalogo[];
  modelos: ModeloDoCatalogo[];
  carrocerias: OpcaoDoCatalogo[];
  gestores: OpcaoDoCatalogo[];
  operacoes: OpcaoDoCatalogo[];
  crs: CrDoCatalogo[];
  /** As filiais (garagem = filial, as 3). */
  filiais: OpcaoDoCatalogo[];
}

export interface ItemCriado {
  tipo: TipoDeItemDeCatalogo;
  id: string;
  /** O nome (no CR, o código). */
  nome: string;
  paiId?: string;
}

/** O que as Server Actions de escrita devolvem como "registro atual" num conflito. */
export type AtualDaAcao = PlacaGravada | PedidoDeTransferencia;

/** Uma placa a escolher num assistente aberto sem placa. */
export interface PlacaAEscolher {
  placa: string;
  nome: string;
}

/** O conjunto de uma placa (cavalo com implementos): o nome vem da tabela de nomenclatura, nunca é gravado. */
export interface ConjuntoDaPlaca {
  /** A placa do cavalo (mestre) do conjunto. */
  cavalo: string;
  /** As placas dos implementos engatados, na ordem da posição. */
  implementos: string[];
  /** "Bitrem Sider"; nulo sem nome definido ou pendente (faltam os eixos). */
  nome: string | null;
}

export interface DadosDosAssistentes {
  /** Quem usa (o id do usuário da sessão): a chave dos rascunhos. */
  usuario: string;
  /** O gestor de frota (a pessoa) de quem usa: só o destinatário recebe e conclui. */
  gestorId: string | null;
  /** `aaaa-mm-dd` em São Paulo. */
  hoje: string;
  anoAtual: number;
  catalogos: Catalogos;
  /** Os tipos que o "+" cria nesta fonte (no banco, só marca, modelo e CR). */
  criaveis: readonly TipoDeItemDeCatalogo[];
  /** A placa do assistente (a da URL, ou a da ficha), com a versão. `null` se não há ou não existe. */
  placaAlvo: PlacaGravada | null;
  /** O pedido de transferência aberto da placa alvo (pendente ou em conferência). */
  pedido: PedidoDeTransferencia | null;
  /** Receber placa aberto sem placa: as placas com pedido pendente para quem usa. */
  placasParaReceber: PlacaAEscolher[];
  /** Concluir recebimento aberto sem placa: as placas recebidas, em conferência, de quem usa. */
  placasParaConcluir: PlacaAEscolher[];
  /** Entregar ao Operacional aberto sem placa: cavalos e caminhões em PÁT ou ETv. */
  placasParaEntregar: PlacaAEscolher[];
  /** A placa alvo é cavalo com implementos (ou implemento engatado): o conjunto dela e o nome. */
  conjuntoDaPlaca: ConjuntoDaPlaca | null;
  /** Engatar implemento: os implementos soltos que podem entrar no conjunto. */
  implementosLivres: PlacaAEscolher[];
}
