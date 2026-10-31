// Leitura do histórico do navegador (só no navegador).

/**
 * A URL da entrada anterior do histórico (Navigation API). Sem a API, `undefined`: não há como
 * saber e o painel fecha sem voltar (tirando `?espiar=` da URL), o caminho que nunca sai do sistema.
 */
export function urlDaEntradaAnterior(): string | null | undefined {
  type Entrada = { url: string | null };
  const navegacao = (
    window as unknown as {
      navigation?: { currentEntry: { index: number } | null; entries(): Entrada[] };
    }
  ).navigation;
  if (!navegacao?.currentEntry) return undefined;
  return navegacao.entries()[navegacao.currentEntry.index - 1]?.url ?? null;
}
