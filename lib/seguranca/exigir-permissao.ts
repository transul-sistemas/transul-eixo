import { CATALOGO, type IdDoModulo } from "@/lib/navegacao/catalogo";
import type { Perfil } from "@/lib/navegacao/perfis";
import type { ClienteDaSessao } from "./cliente-da-sessao";
import { PERMISSOES_DOS_PERFIS } from "./permissoes";

// Permissão = módulo × ação × escopo, conferida no servidor em toda Server Action (fatia 3.8): o
// usuário vem do getUser (nunca do cookie cru) e a permissão vem do banco (config.pode), a cada
// chamada, com a chave do próprio usuário. O banco repete a regra por RLS, com o escopo. O espelho
// em TypeScript (temPermissao) fica só para montar menus.

export interface Permissao {
  modulo: IdDoModulo;
  acao: "criar" | "editar" | "excluir";
}

/** O espelho do seed, só para montar menus e ações na tela; quem decide é o banco. */
export function temPermissao(perfil: Perfil, { modulo, acao }: Permissao): boolean {
  const permissoes = PERMISSOES_DOS_PERFIS[perfil];
  if (permissoes === undefined) return false;
  return permissoes.some((p) => p.modulo === modulo && p.acao === acao);
}

export class ErroDePermissao extends Error {
  readonly codigo = "sem_permissao" as const;
  readonly modulo: IdDoModulo;
  readonly acao: Permissao["acao"];
  constructor(modulo: IdDoModulo, acao: Permissao["acao"]) {
    const nome = CATALOGO.find((m) => m.id === modulo)?.nome ?? modulo;
    super(`Seu perfil não pode ${acao} em ${nome}. Peça a quem administra o acesso.`);
    this.name = "ErroDePermissao";
    this.modulo = modulo;
    this.acao = acao;
  }
}

export class ErroDeSessao extends Error {
  readonly codigo = "sem_sessao" as const;
  constructor() {
    super("Sua sessão terminou. Entre de novo para continuar.");
    this.name = "ErroDeSessao";
  }
}

/** Lança ErroDeSessao sem usuário e ErroDePermissao se o banco disser que não. */
export async function exigirPermissao(
  permissao: Permissao,
  cliente?: ClienteDaSessao,
): Promise<void> {
  const supabase =
    cliente ?? (await (await import("@/lib/supabase/servidor")).criarClienteDoServidor());
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new ErroDeSessao();
  const { data: pode, error } = await supabase
    .schema("config")
    .rpc("pode", { p_modulo: permissao.modulo, p_acao: permissao.acao });
  if (error) throw new Error(`Não foi possível conferir a permissão: ${error.message}`);
  if (pode !== true) throw new ErroDePermissao(permissao.modulo, permissao.acao);
}
