// A chave de envio nasce quando o assistente abre e viaja com a gravação. O clique duplo, o Enter
// repetido e "Tentar de novo" mandam a mesma chave, e o servidor grava uma vez só.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function novaChaveDeEnvio(gerar: () => string = () => crypto.randomUUID()): string {
  return gerar();
}

export function chaveDeEnvioValida(texto: unknown): texto is string {
  return typeof texto === "string" && UUID.test(texto);
}

/**
 * A chave de cada peça de uma gravação em lote (engatar vários implementos): a parte 0 é a própria
 * chave; as outras trocam os últimos 4 dígitos de forma estável, então repetir o envio manda as mesmas.
 */
export function chaveDaParte(chave: string, parte: number): string {
  if (parte === 0) return chave;
  const fim = parseInt(chave.slice(-4), 16);
  const novo = ((fim + parte) % 0x10000).toString(16).padStart(4, "0");
  return `${chave.slice(0, -4)}${novo}`;
}
