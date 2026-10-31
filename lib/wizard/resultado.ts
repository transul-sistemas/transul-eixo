import type { ZodError } from "zod";

// Toda gravação devolve a linha gravada ou um erro tipado (armadilha 7). A tela decide o que fazer
// pelo `codigo`; a `mensagem` já diz o que aconteceu e como resolver, sem pedir desculpas.

export type CodigoDeErro =
  | "entrada_invalida"
  | "sem_permissao"
  | "placa_ja_existe"
  | "conflito"
  | "nao_encontrado"
  | "falha";

export const MENSAGENS_PADRAO: Record<CodigoDeErro, string> = {
  entrada_invalida: "Alguns campos não passaram na conferência. Corrija os campos marcados.",
  sem_permissao: "Seu perfil não permite esta ação. Peça a quem administra o acesso.",
  placa_ja_existe: "Esta placa já está cadastrada. Abra a ficha dela em vez de cadastrar de novo.",
  conflito: "Este registro mudou desde que você o abriu. Veja a versão atual e confira de novo.",
  nao_encontrado:
    "Não achamos este registro. Ele pode ter sido arquivado; volte à lista e procure de novo.",
  falha: "Não foi possível gravar agora. Tente de novo; se continuar, avise o suporte.",
};

export interface ErroDaAcao<TAtual = unknown> {
  codigo: CodigoDeErro;
  mensagem: string;
  /** Mensagens por campo (`conjunto.cavaloId`), na ordem em que foram achadas. */
  campos?: Record<string, string[]>;
  /** Em `conflito` e `placa_ja_existe`: a linha como está agora. */
  atual?: TAtual;
}

export type ResultadoDaAcao<T, TAtual = unknown> =
  { ok: true; linha: T } | { ok: false; erro: ErroDaAcao<TAtual> };

export function sucesso<T>(linha: T): { ok: true; linha: T } {
  return { ok: true, linha };
}

export function erroDaAcao<TAtual = unknown>(
  codigo: CodigoDeErro,
  extras: { mensagem?: string; campos?: Record<string, string[]>; atual?: TAtual } = {},
): { ok: false; erro: ErroDaAcao<TAtual> } {
  const erro: ErroDaAcao<TAtual> = {
    codigo,
    mensagem: extras.mensagem ?? MENSAGENS_PADRAO[codigo],
  };
  if (extras.campos !== undefined) erro.campos = extras.campos;
  if (extras.atual !== undefined) erro.atual = extras.atual;
  return { ok: false, erro };
}

/** Os problemas do Zod por campo, com o caminho separado por pontos. */
export function errosDeCampos(erro: ZodError): Record<string, string[]> {
  const campos: Record<string, string[]> = {};
  for (const problema of erro.issues) {
    const caminho = problema.path.join(".");
    (campos[caminho] ??= []).push(problema.message);
  }
  return campos;
}
