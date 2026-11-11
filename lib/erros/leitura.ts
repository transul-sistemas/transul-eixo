// Erros honestos de leitura (11/11/2026). A falha de uma leitura do banco é classificada NO SERVIDOR, onde o
// erro do PostgREST ou do fetch é capturado, e a causa viaja até a tela no `digest` do erro.
//
// Por quê no digest: em produção o Next não leva a mensagem de um erro lançado no servidor até o
// `error.tsx` (só o `digest`). Quando o erro já traz um `digest`, o Next o respeita e não o troca por um
// hash (next/dist/server/app-render/create-error-handler.js: `if (err.digest) ...`, Next 16). Então o
// `digest` aqui é `eixo-leitura:<causa>:<id>`: só a causa e um identificador, nenhum dado.
//
// Limites: (1) se algum código pegar o erro e lançar outro `Error`, o digest se perde e a tela mostra a causa
// "inesperado" (texto genérico, nunca mentira); (2) o detalhe técnico (função e código) fica num registro em
// memória do servidor, por `id`; em ambiente com várias instâncias a ação pode cair noutra e não achar o
// registro: a tela então mostra só a mensagem. A função e o código só saem para Administrador e Diretoria
// (lib/erros/detalhe-do-erro.ts); os outros perfis nunca os recebem.

export type CausaDaFalha =
  "banco_fora" | "funcao_ausente" | "lenta" | "sem_permissao" | "inesperado";

export interface FalhaClassificada {
  causa: CausaDaFalha;
  funcao?: string;
  codigo?: string;
}

interface ErroBruto {
  code?: unknown;
  message?: unknown;
  status?: unknown;
}

function campos(erro: unknown): { codigo?: string; texto: string; status?: number } {
  if (typeof erro !== "object" || erro === null) return { texto: "" };
  const e = erro as ErroBruto;
  return {
    codigo: typeof e.code === "string" && e.code !== "" ? e.code : undefined,
    texto: typeof e.message === "string" ? e.message : "",
    status: typeof e.status === "number" ? e.status : undefined,
  };
}

/** `nucleo.tarefas_do_usuario` ou `tarefas_do_usuario` no texto "Could not find the function ...". */
function funcaoDoTexto(texto: string): string | undefined {
  const m = /find the function\s+(?:[a-z_0-9]+\.)?([a-z_0-9]+)/i.exec(texto);
  return m?.[1];
}

/** Recebe o erro do PostgREST ou do fetch e diz a causa. Puro: só olha código, status e texto do erro. */
export function classificarFalha(erro: unknown): FalhaClassificada {
  const { codigo, texto, status } = campos(erro);
  const saida = (causa: CausaDaFalha, funcao?: string): FalhaClassificada => ({
    causa,
    ...(funcao ? { funcao } : {}),
    ...(codigo ? { codigo } : {}),
  });
  if (codigo === "PGRST202" || codigo === "42883")
    return saida("funcao_ausente", funcaoDoTexto(texto));
  if (
    codigo === "42501" ||
    codigo === "PGRST301" ||
    status === 401 ||
    status === 403 ||
    /permission denied|JWT expired/i.test(texto)
  ) {
    return saida("sem_permissao");
  }
  if (
    codigo === "57014" ||
    status === 408 ||
    status === 504 ||
    /statement timeout|canceling statement|query timeout/i.test(texto)
  ) {
    return saida("lenta");
  }
  if (
    status === 502 ||
    status === 503 ||
    /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|network|Failed to fetch|Connect Timeout/i.test(
      texto,
    )
  ) {
    return saida("banco_fora");
  }
  return saida("inesperado");
}

export const PREFIXO_DO_DIGEST = "eixo-leitura";

export function montarDigest(causa: CausaDaFalha, id: string): string {
  return `${PREFIXO_DO_DIGEST}:${causa}:${id}`;
}

const CAUSAS: readonly CausaDaFalha[] = [
  "banco_fora",
  "funcao_ausente",
  "lenta",
  "sem_permissao",
  "inesperado",
];

/** Lê o digest de um erro que chegou ao `error.tsx`. Digest de outro tipo (hash do Next) ou ausente: nulo. */
export function lerDigest(digest: unknown): { causa: CausaDaFalha; id: string } | null {
  if (typeof digest !== "string") return null;
  const [prefixo, causa, id] = digest.split(":");
  if (prefixo !== PREFIXO_DO_DIGEST || !id) return null;
  const achada = CAUSAS.find((c) => c === causa);
  return achada ? { causa: achada, id } : null;
}

export interface DetalheTecnico {
  funcao: string;
  codigo?: string;
}

const REGISTRO = new Map<string, DetalheTecnico>();
const TAMANHO_DO_REGISTRO = 200;

/** O detalhe técnico guardado no servidor para o `id` do digest (só quem for Administrador ou Diretoria o recebe). */
export function detalheRegistrado(id: string): DetalheTecnico | undefined {
  return REGISTRO.get(id);
}

/** O erro de leitura que as leituras de `lib/dados` lançam: a causa já decidida e o digest para a tela. */
export class ErroDeLeitura extends Error {
  readonly causa: CausaDaFalha;
  readonly funcao: string;
  readonly codigo?: string;
  digest: string;
  constructor(funcao: string, falha: FalhaClassificada, id: string, mensagem: string) {
    // A mensagem é a de sempre (`função: texto do banco`), para o diagnóstico em desenvolvimento e os testes;
    // ela não vai à tela (em produção o Next a esconde) e o log usa só função, causa e código.
    super(`${funcao}: ${mensagem}`);
    this.name = "ErroDeLeitura";
    this.causa = falha.causa;
    this.funcao = funcao;
    this.codigo = falha.codigo;
    this.digest = montarDigest(falha.causa, id);
  }
}

/**
 * Classifica a falha, guarda o detalhe técnico e devolve o erro para `throw`. Registra no log só a função,
 * a causa e o código (nunca a mensagem nem valores de parâmetros).
 */
export function falhaDeLeitura(funcao: string, erro: unknown): ErroDeLeitura {
  const falha = classificarFalha(erro);
  const id = Math.random().toString(36).slice(2, 10);
  const funcaoCerta = falha.funcao ?? funcao;
  REGISTRO.set(id, { funcao: funcaoCerta, ...(falha.codigo ? { codigo: falha.codigo } : {}) });
  if (REGISTRO.size > TAMANHO_DO_REGISTRO) {
    const primeiro = REGISTRO.keys().next().value;
    if (primeiro !== undefined) REGISTRO.delete(primeiro);
  }
  console.error(
    `leitura falhou: função ${funcaoCerta}, causa ${falha.causa}, código ${falha.codigo ?? "-"}`,
  );
  return new ErroDeLeitura(funcao, falha, id, campos(erro).texto);
}
