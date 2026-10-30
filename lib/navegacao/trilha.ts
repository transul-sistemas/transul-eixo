import { acharFicha, acharTela } from "./catalogo";
import type { Perfil } from "./perfis";
import { rotaInicialDoModulo } from "./visibilidade";

export interface Migalha {
  readonly texto: string;
  /** Sem `href` a migalha é só texto (a página atual, ou um módulo que o perfil não abre). */
  readonly href?: string;
  readonly atual?: true;
}

/**
 * A trilha da página: Módulo › Tela, e o modo como última migalha quando há um (`?modo=`); na ficha
 * de um item, Módulo › Tela › o item. Lê só o catálogo. O módulo leva à primeira tela que o perfil pode abrir.
 */
export function migalhas(rota: string, perfil: Perfil, modo?: string | null): readonly Migalha[] {
  const achada = acharTela(rota);
  const ficha = achada ? undefined : acharFicha(rota);
  const origem = achada ?? ficha;
  if (!origem) return [];
  const { modulo, tela } = origem;
  const inicial = rotaInicialDoModulo(perfil, modulo.id);
  const deModulo: Migalha = inicial
    ? { texto: modulo.nome, href: inicial }
    : { texto: modulo.nome };
  // A ficha: Módulo › Tela (volta à lista) › o identificador, que é a página atual.
  if (ficha) {
    return [
      deModulo,
      { texto: tela.nome, href: tela.rota },
      { texto: ficha.identificador, atual: true },
    ];
  }
  const doModo = modo ? tela.modos?.find((m) => m.id === modo) : undefined;
  if (!doModo) return [deModulo, { texto: tela.nome, atual: true }];
  return [deModulo, { texto: tela.nome, href: tela.rota }, { texto: doModo.nome, atual: true }];
}
