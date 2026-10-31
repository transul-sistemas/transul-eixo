// A chave de envio nasce quando o assistente abre e viaja com a gravação. O clique duplo, o Enter
// repetido e "Tentar de novo" mandam a mesma chave, e o servidor grava uma vez só.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function novaChaveDeEnvio(gerar: () => string = () => crypto.randomUUID()): string {
  return gerar();
}

export function chaveDeEnvioValida(texto: unknown): texto is string {
  return typeof texto === "string" && UUID.test(texto);
}
