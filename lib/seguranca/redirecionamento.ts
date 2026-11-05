import type { Perfil } from "@/lib/navegacao/perfis";

// Depois do login, o "proximo" só leva a um caminho interno do Eixo. Qualquer outra coisa (endereço de
// fora, "//site", barra invertida, esquema, caractere de controle, as próprias telas de entrada) vai
// para a primeira tela do perfil: é a defesa contra o redirecionamento aberto.

/**
 * A primeira tela de cada perfil (aprovação da 3.8, 04/11/2026): o primeiro módulo que o perfil pode
 * ver, sempre uma tela (nunca a página do módulo, que redireciona de novo) e nunca uma rota que dá 404
 * para ele. As telas do Operacional ainda estão "em breve": o Operacional cai no Pátio em breve.
 */
const DESTINO_DO_PERFIL: Record<Perfil, string> = {
  Administrador: "/inicio/tarefas",
  Diretoria: "/inicio/tarefas",
  "Gestor de frota": "/frota/placas",
  Operacional: "/operacional/patio",
};

export function destinoInicial(perfil: Perfil): string {
  return DESTINO_DO_PERFIL[perfil];
}

/** Só quando o perfil não é conhecido (nunca deveria acontecer com vínculo ativo). */
export const DESTINO_PADRAO = "/inicio/tarefas";

const TELAS_DE_ENTRADA = ["/entrar", "/esqueci-a-senha"];

/** O caminho interno pedido, ou nulo (de fora, telas de entrada, a raiz): aí vale a primeira tela. */
export function caminhoInterno(valor: string | null | undefined): string | null {
  if (!valor) return null;
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(valor);
  } catch {
    return null;
  }
  for (const texto of [valor, decodificado]) {
    if (!texto.startsWith("/")) return null;
    if (texto.startsWith("//") || texto.startsWith("/\\")) return null;
    if (/[\\\s]/.test(texto) || /[\u0000-\u001f\u007f]/.test(texto)) return null;
  }
  // Começando com uma barra só (sem barra invertida nem espaço), o endereço fica na mesma origem; o
  // URL só normaliza o caminho (ex.: /a/../entrar vira /entrar).
  const url = new URL(valor, "http://eixo.interno");
  if (url.pathname === "/") return null;
  if (TELAS_DE_ENTRADA.some((t) => url.pathname === t || url.pathname.startsWith(`${t}/`)))
    return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
