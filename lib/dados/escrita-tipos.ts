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
  operacaoId: string;
}
export interface GaragemDoCatalogo extends OpcaoDoCatalogo {
  filialId: string;
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

/** A placa como o armazém a guarda: o que a tela mostra mais a versão e o histórico de gestores. */
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
  filialId: string | null;
  filial: string;
  garagemId: string | null;
  garagem: string;
  motoristaId: string | null;
  metaDoConjuntoCentavos: number | null;
  valor: ValorDaPlaca;
  conjunto: { cavaloId: string | null; implementoIds: string[] };
  /** Sobe a cada mudança (edição concorrente). */
  versao: number;
  gestores: VigenciaDeGestor[];
}

export interface Catalogos {
  marcas: OpcaoDoCatalogo[];
  modelos: ModeloDoCatalogo[];
  gestores: OpcaoDoCatalogo[];
  operacoes: OpcaoDoCatalogo[];
  crs: CrDoCatalogo[];
  filiais: OpcaoDoCatalogo[];
  garagens: GaragemDoCatalogo[];
  motoristas: OpcaoDoCatalogo[];
}

export interface ItemCriado {
  tipo: TipoDeItemDeCatalogo;
  id: string;
  /** O nome (no CR, o código). */
  nome: string;
  paiId?: string;
}

export interface CandidatoDoConjunto {
  id: string;
  nome: string;
}

/** O que as Server Actions de escrita devolvem como "registro atual" num conflito. */
export type AtualDaAcao = PlacaGravada | PedidoDeTransferencia;
