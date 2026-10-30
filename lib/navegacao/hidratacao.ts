// Quais trechos da página já hidrataram. O React hidrata cada fronteira de Suspense separadamente
// (o topo, a barra de consulta e a lista), cada uma no seu tempo. O painel de espiar aberto por
// link direto marca os irmãos com `aria-hidden` no cliente; se algum irmão ainda não hidratou, o
// HTML do servidor não tem esse atributo e o React acusa diferença. Então o painel de link direto
// espera todas as regiões avisarem que hidrataram.

export interface LojaDeHidratacao {
  /** Para o `useSyncExternalStore` do React. Devolve a função que cancela a assinatura. */
  assinar(ouvinte: () => void): () => void;
  /** Todas as regiões esperadas já hidrataram? */
  pronta(): boolean;
  /** No servidor nada hidratou: é o que o HTML inicial e a hidratação enxergam. */
  prontaNoServidor(): boolean;
  /** Uma região hidratou. Devolve a função que desfaz a marca (a região saiu da tela). */
  marcar(regiao: string): () => void;
}

export function criarLojaDeHidratacao(regioes: readonly string[]): LojaDeHidratacao {
  const esperadas = new Set(regioes);
  // Conta de marcas por região: uma região que remonta marca de novo antes de a antiga desmarcar.
  const marcas = new Map<string, number>();
  const ouvintes = new Set<() => void>();
  let pronta = esperadas.size === 0;

  function recalcular() {
    const agora = [...esperadas].every((regiao) => (marcas.get(regiao) ?? 0) > 0);
    if (agora === pronta) return;
    pronta = agora;
    for (const ouvinte of ouvintes) ouvinte();
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => void ouvintes.delete(ouvinte);
    },
    pronta: () => pronta,
    prontaNoServidor: () => false,
    marcar(regiao) {
      if (!esperadas.has(regiao)) return () => {};
      marcas.set(regiao, (marcas.get(regiao) ?? 0) + 1);
      recalcular();
      let desfeita = false;
      return () => {
        if (desfeita) return;
        desfeita = true;
        marcas.set(regiao, (marcas.get(regiao) ?? 1) - 1);
        recalcular();
      };
    },
  };
}
