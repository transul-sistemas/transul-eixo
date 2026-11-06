import type { Catalogos, ItemCriado } from "./escrita-tipos";

/**
 * O catálogo que veio do servidor mais o que o "+" acabou de criar na tela (o servidor devolve o
 * mesmo item na próxima renderização; aqui ele não entra duas vezes). Não muda o catálogo de entrada.
 */
export function mesclarCatalogos(base: Catalogos, criados: readonly ItemCriado[]): Catalogos {
  const c: Catalogos = {
    marcas: [...base.marcas],
    modelos: [...base.modelos],
    carrocerias: [...base.carrocerias],
    gestores: [...base.gestores],
    operacoes: [...base.operacoes],
    crs: [...base.crs],
    filiais: [...base.filiais],
  };
  const tem = (lista: readonly { id: string }[], id: string) => lista.some((i) => i.id === id);
  for (const item of criados) {
    const { id, nome, paiId } = item;
    switch (item.tipo) {
      case "marca":
        if (!tem(c.marcas, id)) c.marcas.push({ id, nome });
        break;
      case "modelo":
        if (paiId && !tem(c.modelos, id)) c.modelos.push({ id, nome, marcaId: paiId });
        break;
      case "gestor":
        if (!tem(c.gestores, id)) c.gestores.push({ id, nome });
        break;
      case "operacao":
        if (!tem(c.operacoes, id)) c.operacoes.push({ id, nome });
        break;
      case "cr":
        if (!tem(c.crs, id)) c.crs.push({ id, codigo: nome, operacaoId: paiId ?? null });
        break;
      case "filial":
        if (!tem(c.filiais, id)) c.filiais.push({ id, nome });
        break;
    }
  }
  return c;
}
