// Contexto global do Eixo: período, filial, operação e regime. Vive na URL (filtro na URL, voltar
// devolve ao mesmo ponto) e acompanha a pessoa de uma tela para outra.

export const CHAVES_DO_CONTEXTO = ["periodo", "filial", "operacao", "regime"] as const;

export interface ContextoGlobal {
  /** Mês no formato `aaaa-mm`. */
  readonly periodo: string;
  readonly filial: string;
  readonly operacao: string;
  readonly regime: string;
}

export interface OpcaoDoContexto {
  readonly id: string;
  readonly nome: string;
}

export interface OpcoesDoContexto {
  readonly filiais: readonly OpcaoDoContexto[];
  readonly operacoes: readonly OpcaoDoContexto[];
  readonly regimes: readonly OpcaoDoContexto[];
}

// Só o que já existe: filiais e operações chegam com os cadastros (Fase 4), e o regime é só o
// gerencial por ora (competência gerencial, docs/projeto-tecnico.md).
export const OPCOES_PROVISORIAS: OpcoesDoContexto = {
  filiais: [{ id: "todas", nome: "Todas as filiais" }],
  operacoes: [{ id: "todas", nome: "Todas as operações" }],
  regimes: [{ id: "gerencial", nome: "Gerencial" }],
};

/** Mês (`aaaa-mm`) de uma data `aaaa-mm-dd`. */
export function periodoDe(dia: string): string {
  return dia.slice(0, 7);
}

export function periodoValido(texto: string): boolean {
  const achado = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(texto);
  return achado !== null && Number(achado[1]) >= 2000;
}

function opcaoValida(valor: string | null, opcoes: readonly OpcaoDoContexto[]): string {
  const padrao = opcoes[0]?.id ?? "";
  return valor !== null && opcoes.some((opcao) => opcao.id === valor) ? valor : padrao;
}

/** Lê o contexto da URL. O que faltar ou for inválido volta ao padrão. `hoje` é `aaaa-mm-dd`. */
export function lerContexto(
  parametros: URLSearchParams,
  hoje: string,
  opcoes: OpcoesDoContexto = OPCOES_PROVISORIAS,
): ContextoGlobal {
  const periodo = parametros.get("periodo");
  return {
    periodo: periodo !== null && periodoValido(periodo) ? periodo : periodoDe(hoje),
    filial: opcaoValida(parametros.get("filial"), opcoes.filiais),
    operacao: opcaoValida(parametros.get("operacao"), opcoes.operacoes),
    regime: opcaoValida(parametros.get("regime"), opcoes.regimes),
  };
}

/**
 * Devolve parâmetros novos com o contexto escrito. Só vai para a URL o que difere do padrão, e o
 * que não é contexto (modo, busca, filtros) fica como estava.
 */
export function escreverContexto(
  parametros: URLSearchParams,
  contexto: ContextoGlobal,
  hoje: string,
  opcoes: OpcoesDoContexto = OPCOES_PROVISORIAS,
): URLSearchParams {
  const padrao = lerContexto(new URLSearchParams(), hoje, opcoes);
  const novos = new URLSearchParams(parametros);
  for (const chave of CHAVES_DO_CONTEXTO) {
    novos.delete(chave);
    if (contexto[chave] !== padrao[chave]) novos.set(chave, contexto[chave]);
  }
  return novos;
}

/**
 * Leva o contexto da URL atual para um link, sem trazer os filtros da tela de origem e sem
 * sobrescrever o que o próprio link já define.
 */
export function anexarContexto(rota: string, parametros: URLSearchParams): string {
  const [caminho = "", consulta = ""] = rota.split("?");
  const destino = new URLSearchParams(consulta);
  for (const chave of CHAVES_DO_CONTEXTO) {
    const valor = parametros.get(chave);
    if (valor && !destino.has(chave)) destino.set(chave, valor);
  }
  const texto = destino.toString();
  return texto ? `${caminho}?${texto}` : caminho;
}
