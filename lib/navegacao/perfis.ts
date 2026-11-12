import type { IdDoModulo } from "./catalogo";

// Perfis conhecidos pela navegação. O perfil de quem usa vem da sessão (lib/seguranca/sessao, lido do
// banco a cada pedido); a regra de visibilidade é testada para todos eles.
export const PERFIS = ["Administrador", "Diretoria", "Gestor de frota", "Operacional"] as const;

export type Perfil = (typeof PERFIS)[number];

/** Telas em breve só aparecem para quem acompanha a construção do sistema. */
export const PERFIS_QUE_VEEM_EM_BREVE: readonly Perfil[] = ["Administrador", "Diretoria"];

/** Telas "esqueleto" (estrutura sem fonte de dados) só aparecem para quem acompanha a construção. */
export const PERFIS_QUE_VEEM_ESQUELETO: readonly Perfil[] = ["Administrador", "Diretoria"];

/** Módulos que cada perfil pode ver (permissão `<módulo>.ver`). Provisório até a Fase 3. */
export const MODULOS_POR_PERFIL: Record<Perfil, "todos" | readonly IdDoModulo[]> = {
  Administrador: "todos",
  Diretoria: "todos",
  "Gestor de frota": ["inicio", "frota"],
  Operacional: ["inicio", "operacional", "pessoas"],
};

/**
 * Telas a que o perfil se limita dentro de um módulo (o resto do módulo não abre nem aparece). O
 * Operacional tem Pessoas › ver com escopo filial (10/11/2026): só a Escala; a lista e a ficha pedem o
 * escopo tudo.
 */
export const TELAS_POR_PERFIL: Partial<
  Record<Perfil, Partial<Record<IdDoModulo, readonly string[]>>>
> = {
  Operacional: { pessoas: ["pessoas.escala"] },
};

/**
 * Telas em teste (indicador "Teste"): só o Administrador as vê no menu e no Ctrl+K e só ele as abre; para
 * os demais perfis a rota responde como "não encontrada". Sai daqui quando a tela for liberada.
 */
export const TELAS_SO_DO_ADMINISTRADOR: readonly string[] = ["inicio.meu-dia"];
