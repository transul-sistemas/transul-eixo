import {
  type AcaoDaBarra,
  chaveDoEstado,
  ESTADO_INICIAL,
  type EstadoDaBarra,
  gravarEstado,
  lerEstado,
  limparPeloCatalogo,
  reduzir,
} from "./estado-da-barra";

export interface OpcoesDaLoja {
  readonly usuario: string;
  /** Onde lembrar o estado. `null` não lembra de nada (a barra da página de demonstração). */
  readonly armazenamento: Pick<Storage, "getItem" | "setItem"> | null;
  /** Estado de partida: o do servidor e o do cliente enquanto nada foi lido. */
  readonly inicial?: EstadoDaBarra;
}

export interface LojaDaBarra {
  /** Para o `useSyncExternalStore` do React. Devolve a função que cancela a assinatura. */
  assinar(ouvinte: () => void): () => void;
  /** Lê a memória na primeira chamada; depois devolve sempre o mesmo objeto até haver mudança. */
  estadoNoCliente(): EstadoDaBarra;
  /** Nunca toca na memória: é o que o servidor renderiza. */
  estadoNoServidor(): EstadoDaBarra;
  despachar(acao: AcaoDaBarra): void;
}

/**
 * Guarda o estado da barra lateral e a memória por usuário. A leitura da memória só acontece no
 * cliente, depois da hidratação, para o HTML do servidor e o primeiro desenho do cliente serem
 * iguais.
 */
export function criarLoja({
  usuario,
  armazenamento,
  inicial = ESTADO_INICIAL,
}: OpcoesDaLoja): LojaDaBarra {
  let atual = inicial;
  let carregada = false;
  const ouvintes = new Set<() => void>();

  function carregar() {
    if (carregada) return;
    carregada = true;
    if (!armazenamento) return;
    let bruto: string | null;
    try {
      bruto = armazenamento.getItem(chaveDoEstado(usuario));
    } catch {
      return;
    }
    if (bruto === null) return;
    atual = limparPeloCatalogo(lerEstado(usuario, { getItem: () => bruto }));
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => void ouvintes.delete(ouvinte);
    },
    estadoNoCliente() {
      carregar();
      return atual;
    },
    estadoNoServidor() {
      return inicial;
    },
    despachar(acao) {
      carregar();
      const proximo = reduzir(atual, acao);
      if (proximo === atual) return;
      atual = proximo;
      if (armazenamento) gravarEstado(usuario, atual, armazenamento);
      for (const ouvinte of ouvintes) ouvinte();
    },
  };
}
