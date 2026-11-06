import { diasEntre } from "./dias";
import { type Sigla, grupoDaSigla } from "./status";

export interface DadosParaAlertas {
  tipo: string;
  modelo: string;
  sigla: Sigla;
  /** Desde quando a placa está nesta situação, `aaaa-mm-ddThh:mm`. */
  desde: string;
  motorista: string | null;
  crlvVenceEm: string | null;
  /** Vigências de CR, `[início, fim)`; `fim` nulo = em aberto. */
  crs: { inicio: string; fim: string | null }[];
  /** Implemento sem cavalo na composição vigente. */
  semCavalo: boolean;
}

/**
 * Os alertas que o banco calcula (nucleo.alerta_de_vinculo): no modo banco, a lista e a ficha mostram
 * estes, com o texto da tela. A regra de cada um vive só no banco.
 */
export const TEXTOS_DOS_ALERTAS_DO_BANCO = {
  sem_cr: "Sem CR vigente",
  buraco_em_cr: "Período sem CR",
  buraco_em_custodia: "Período sem custódia",
  implemento_sem_eixos: "Implemento sem os eixos",
  conjunto_sem_nome: "Conjunto sem nome definido",
  correcao_tardia_de_status: "Situação corrigida fora do prazo",
  parado_em_patio: "Parada no pátio além do prazo",
  ativo_sem_operacao: "Sem operação",
  placa_com_dois_cr_do_mesmo_tipo: "Dois CRs do mesmo tipo",
  cadastro_incompleto: "Cadastro incompleto (falta RENAVAM ou carroceria)",
} as const;
export type CodigoDeAlertaDoBanco = keyof typeof TEXTOS_DOS_ALERTAS_DO_BANCO;

export type CodigoDeAlerta =
  | "modelo-a-definir"
  | "crlv-vencido"
  | "sem-motorista"
  | "implemento-solto"
  | "cr-sobreposto"
  | CodigoDeAlertaDoBanco;

export interface Alerta {
  codigo: CodigoDeAlerta;
  texto: string;
}

/** Implemento sem cavalo por mais de 30 dias passa a ser alerta. */
export const DIAS_DE_IMPLEMENTO_SOLTO = 30;

/** O que está errado ou fora do esperado numa placa, na ordem em que aparece na tela. */
export function alertasDaPlaca(dados: DadosParaAlertas, hoje: string): Alerta[] {
  const alertas: Alerta[] = [];
  if (dados.modelo.trim().toUpperCase() === "A DEFINIR") {
    alertas.push({ codigo: "modelo-a-definir", texto: "Modelo a definir" });
  }
  if (dados.crlvVenceEm !== null && dados.crlvVenceEm < hoje) {
    alertas.push({ codigo: "crlv-vencido", texto: "Documento (CRLV) vencido" });
  }
  if (
    dados.tipo === "cavalo" &&
    dados.motorista === null &&
    grupoDaSigla(dados.sigla) === "em-atividade"
  ) {
    alertas.push({ codigo: "sem-motorista", texto: "Cavalo em atividade sem motorista" });
  }
  if (
    dados.tipo === "implemento" &&
    dados.semCavalo &&
    diasEntre(dados.desde, hoje) > DIAS_DE_IMPLEMENTO_SOLTO
  ) {
    alertas.push({ codigo: "implemento-solto", texto: "Implemento solto há mais de 30 dias" });
  }
  const vigentes = dados.crs.filter(
    (cr) => cr.inicio <= hoje && (cr.fim === null || hoje < cr.fim),
  );
  if (vigentes.length > 1) {
    alertas.push({ codigo: "cr-sobreposto", texto: "Dois CRs vigentes ao mesmo tempo" });
  }
  return alertas;
}

/** O alerta do banco com o texto da tela; um código que a tela não conhece lança (nunca some calado). */
export function alertaDoBanco(codigo: string): Alerta {
  if (!(codigo in TEXTOS_DOS_ALERTAS_DO_BANCO)) {
    throw new Error(`Alerta do banco desconhecido pela tela: ${codigo}`);
  }
  const conhecido = codigo as CodigoDeAlertaDoBanco;
  return { codigo: conhecido, texto: TEXTOS_DOS_ALERTAS_DO_BANCO[conhecido] };
}
