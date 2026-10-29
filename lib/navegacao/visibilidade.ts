import { CATALOGO, type IdDoModulo, type ModuloDoCatalogo, type Tela } from "./catalogo";
import { MODULOS_POR_PERFIL, PERFIS_QUE_VEEM_EM_BREVE, type Perfil } from "./perfis";

export function temOModulo(perfil: Perfil, modulo: IdDoModulo): boolean {
  const permitidos = MODULOS_POR_PERFIL[perfil];
  return permitidos === "todos" || permitidos.includes(modulo);
}

export function veEmBreve(perfil: Perfil): boolean {
  return PERFIS_QUE_VEEM_EM_BREVE.includes(perfil);
}

/** Pode abrir: tem o módulo e a tela está pronta (ou em breve, para quem acompanha a obra). */
export function podeAbrir(perfil: Perfil, tela: Tela): boolean {
  if (!temOModulo(perfil, tela.permissao.modulo)) return false;
  if (tela.estado === "pronto") return true;
  if (tela.estado === "em-breve") return veEmBreve(perfil);
  return false;
}

/** Aparece no menu: o que se pode abrir mais a tela restrita, que aparece desabilitada. */
function apareceNoMenu(perfil: Perfil, tela: Tela): boolean {
  return (
    podeAbrir(perfil, tela) ||
    (tela.estado === "restrito" && temOModulo(perfil, tela.permissao.modulo))
  );
}

/** Módulos e telas que o perfil vê, na ordem do catálogo. Módulo sem tela visível some. */
export function modulosVisiveis(
  perfil: Perfil,
  catalogo: readonly ModuloDoCatalogo[] = CATALOGO,
): readonly ModuloDoCatalogo[] {
  return catalogo
    .map((modulo) => ({ ...modulo, telas: modulo.telas.filter((t) => apareceNoMenu(perfil, t)) }))
    .filter((modulo) => modulo.telas.length > 0);
}

/** Para onde o módulo leva: a primeira tela que o perfil pode abrir, ou nada se não houver. */
export function rotaInicialDoModulo(
  perfil: Perfil,
  modulo: IdDoModulo,
  catalogo: readonly ModuloDoCatalogo[] = CATALOGO,
): string | undefined {
  return catalogo.find((m) => m.id === modulo)?.telas.find((t) => podeAbrir(perfil, t))?.rota;
}
