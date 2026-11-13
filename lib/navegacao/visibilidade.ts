import { CATALOGO, type IdDoModulo, type ModuloDoCatalogo, type Tela } from "./catalogo";
import {
  MODULOS_POR_PERFIL,
  PERFIS_QUE_VEEM_EM_BREVE,
  PERFIS_QUE_VEEM_ESQUELETO,
  type Perfil,
  TELAS_EM_TESTE_NA_DEMONSTRACAO,
  TELAS_POR_PERFIL,
  TELAS_SO_DO_ADMINISTRADOR,
} from "./perfis";

export function temOModulo(perfil: Perfil, modulo: IdDoModulo): boolean {
  const permitidos = MODULOS_POR_PERFIL[perfil];
  return permitidos === "todos" || permitidos.includes(modulo);
}

/** A tela não está fora do recorte do perfil no módulo (TELAS_POR_PERFIL). */
export function telaLiberada(
  perfil: Perfil,
  tela: Pick<Tela, "id" | "permissao">,
  emDemonstracao = false,
): boolean {
  if (perfil !== "Administrador" && TELAS_SO_DO_ADMINISTRADOR.includes(tela.id)) {
    // Tela em teste: com o banco em demonstração, os perfis listados também a veem.
    if (!emDemonstracao || !TELAS_EM_TESTE_NA_DEMONSTRACAO[tela.id]?.includes(perfil)) return false;
  }
  const recorte = TELAS_POR_PERFIL[perfil]?.[tela.permissao.modulo];
  return recorte === undefined || recorte.includes(tela.id);
}

export function veEmBreve(perfil: Perfil): boolean {
  return PERFIS_QUE_VEEM_EM_BREVE.includes(perfil);
}

export function veEsqueleto(perfil: Perfil): boolean {
  return PERFIS_QUE_VEEM_ESQUELETO.includes(perfil);
}

/** Pode abrir: tem o módulo e a tela está pronta (ou é esqueleto ou em breve, para quem acompanha a obra). */
export function podeAbrir(perfil: Perfil, tela: Tela, emDemonstracao = false): boolean {
  if (!temOModulo(perfil, tela.permissao.modulo) || !telaLiberada(perfil, tela, emDemonstracao))
    return false;
  if (tela.estado === "pronto") return true;
  if (tela.estado === "esqueleto") return veEsqueleto(perfil);
  if (tela.estado === "em-breve") return veEmBreve(perfil);
  return false;
}

/** Aparece no menu: o que se pode abrir mais a tela restrita, que aparece desabilitada. */
function apareceNoMenu(perfil: Perfil, tela: Tela, emDemonstracao: boolean): boolean {
  return (
    podeAbrir(perfil, tela, emDemonstracao) ||
    (tela.estado === "restrito" &&
      temOModulo(perfil, tela.permissao.modulo) &&
      telaLiberada(perfil, tela, emDemonstracao))
  );
}

/** Módulos e telas que o perfil vê, na ordem do catálogo. Módulo sem tela visível some. */
export function modulosVisiveis(
  perfil: Perfil,
  catalogo: readonly ModuloDoCatalogo[] = CATALOGO,
  emDemonstracao = false,
): readonly ModuloDoCatalogo[] {
  return catalogo
    .map((modulo) => ({
      ...modulo,
      telas: modulo.telas.filter((t) => apareceNoMenu(perfil, t, emDemonstracao)),
    }))
    .filter((modulo) => modulo.telas.length > 0);
}

/** Para onde o módulo leva: a primeira tela que o perfil pode abrir, ou nada se não houver. */
export function rotaInicialDoModulo(
  perfil: Perfil,
  modulo: IdDoModulo,
  catalogo: readonly ModuloDoCatalogo[] = CATALOGO,
  emDemonstracao = false,
): string | undefined {
  return catalogo
    .find((m) => m.id === modulo)
    ?.telas.find((t) => podeAbrir(perfil, t, emDemonstracao))?.rota;
}
