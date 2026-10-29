import type { IdDoModulo } from "./catalogo";

// Perfis conhecidos pela navegação. A permissão de verdade (RLS) é da Fase 3; até lá o perfil
// é provisório e a regra de visibilidade já é testada para todos eles.
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

/** Provisório: sem login ainda, quem usa o sistema é o Administrador. Troca na Fase 3. */
export function perfilAtual(): Perfil {
  return "Administrador";
}

/** Provisório até haver login: a memória da barra lateral é guardada por este nome. */
export const USUARIO_PROVISORIO = "provisorio";
