import type { IdDoModulo } from "@/lib/navegacao/catalogo";
import { MODULOS_POR_PERFIL, type Perfil, perfilAtual } from "@/lib/navegacao/perfis";

// Permissão = módulo × ação (e, na Fase 3, escopo), conferida no servidor em toda Server Action.
// Provisório até a Fase 3: não há login nem RLS ainda, então a regra sai do perfil atual e da tabela
// `MODULOS_POR_PERFIL`. Na Fase 3 esta função passa a ler a sessão, e o banco repete a regra por RLS.

export interface Permissao {
  modulo: IdDoModulo;
  acao: "criar" | "editar" | "excluir";
}

/** Administrador e Diretoria fazem tudo; os demais, só nos módulos do seu perfil. */
export function temPermissao(perfil: Perfil, { modulo }: Permissao): boolean {
  const modulos = MODULOS_POR_PERFIL[perfil];
  if (modulos === undefined) return false;
  return modulos === "todos" || modulos.includes(modulo);
}

export class ErroDePermissao extends Error {
  readonly codigo = "sem_permissao" as const;
  constructor(
    readonly modulo: IdDoModulo,
    readonly acao: Permissao["acao"],
    readonly perfil: Perfil,
  ) {
    super(
      `O perfil ${perfil} não pode ${acao === "criar" ? "criar" : acao === "editar" ? "editar" : "excluir"} em ${modulo}. Peça a quem administra o acesso.`,
    );
    this.name = "ErroDePermissao";
  }
}

/** Lança `ErroDePermissao` se o perfil não tem a permissão. Sem perfil na chamada, usa o atual. */
export function exigirPermissao(permissao: Permissao, perfil: Perfil = perfilAtual()): void {
  if (!temPermissao(perfil, permissao)) {
    throw new ErroDePermissao(permissao.modulo, permissao.acao, perfil);
  }
}
