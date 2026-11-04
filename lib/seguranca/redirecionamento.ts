// Depois do login, o "proximo" só leva a um caminho interno do Eixo. Qualquer outra coisa (endereço de
// fora, "//site", barra invertida, esquema, caractere de controle, as próprias telas de entrada) vai
// para a tela inicial: é a defesa contra o redirecionamento aberto.

export const DESTINO_PADRAO = "/inicio/tarefas";

const TELAS_DE_ENTRADA = ["/entrar", "/esqueci-a-senha"];

export function caminhoInterno(valor: string | null | undefined): string {
  if (!valor) return DESTINO_PADRAO;
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(valor);
  } catch {
    return DESTINO_PADRAO;
  }
  for (const texto of [valor, decodificado]) {
    if (!texto.startsWith("/")) return DESTINO_PADRAO;
    if (texto.startsWith("//") || texto.startsWith("/\\")) return DESTINO_PADRAO;
    if (/[\\\s]/.test(texto) || /[\u0000-\u001f\u007f]/.test(texto)) return DESTINO_PADRAO;
  }
  // Começando com uma barra só (sem barra invertida nem espaço), o endereço fica na mesma origem; o
  // URL só normaliza o caminho (ex.: /a/../entrar vira /entrar).
  const url = new URL(valor, "http://eixo.interno");
  if (TELAS_DE_ENTRADA.some((t) => url.pathname === t || url.pathname.startsWith(`${t}/`)))
    return DESTINO_PADRAO;
  return `${url.pathname}${url.search}${url.hash}`;
}
