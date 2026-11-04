import type { IdDoModulo } from "./catalogo";

// Perfis conhecidos pela navegação. O perfil de quem usa vem da sessão (lib/seguranca/sessao, lido do
// banco a cada pedido); a regra de visibilidade é testada para todos eles.
export const PERFIS = ["Administrador", "Diretoria", "Gestor de frota", "Operacional"] as const;

export type Perfil = (typeof PERFIS)[number];

/** Telas em breve só aparecem para quem acompanha a construção do sistema. */
export const PERFIS_QUE_VEEM_EM_BREVE: readonly Perfil[] = ["Administrador", "Diretoria"];

/** Módulos que cada perfil pode ver (permissão `<módulo>.ver`). Provisório até a Fase 3. */
export const MODULOS_POR_PERFIL: Record<Perfil, "todos" | readonly IdDoModulo[]> = {
  Administrador: "todos",
  Diretoria: "todos",
  "Gestor de frota": ["inicio", "frota"],
  Operacional: ["inicio", "operacional"],
};

/** A memória da barra lateral e dos rascunhos continua com este nome até a 3.9 (hipótese da 3.8). */
export const USUARIO_PROVISORIO = "provisorio";
