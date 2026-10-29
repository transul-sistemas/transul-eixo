// Gaveta do menu: abaixo de 1024 px a barra lateral vira uma gaveta. O botão "Abrir menu" (no topo)
// e a barra ficam em partes diferentes da página, então dividem este estado.

export interface LojaDaGaveta {
  /** Para o `useSyncExternalStore` do React. Devolve a função que cancela a assinatura. */
  assinar(ouvinte: () => void): () => void;
  estaAberta(): boolean;
  abrir(): void;
  fechar(): void;
  alternar(): void;
}

export function criarLojaDaGaveta(): LojaDaGaveta {
  let aberta = false;
  const ouvintes = new Set<() => void>();

  function mudar(proxima: boolean) {
    if (proxima === aberta) return;
    aberta = proxima;
    for (const ouvinte of ouvintes) ouvinte();
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => void ouvintes.delete(ouvinte);
    },
    estaAberta: () => aberta,
    abrir: () => mudar(true),
    fechar: () => mudar(false),
    alternar: () => mudar(!aberta),
  };
}

/** A gaveta do sistema. Só muda por clique e tecla, no navegador. */
export const gaveta = criarLojaDaGaveta();
